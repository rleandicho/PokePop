#!/usr/bin/env node
/**
 * PokePop – Card Database Import Script
 *
 * Reads card and set JSON from a local clone of:
 *   https://github.com/PokemonTCG/pokemon-tcg-data
 * and batch-upserts into your Supabase tcg_sets, tcg_cards, and tcg_prices tables.
 *
 * Usage:
 *   node scripts/import-cards.mjs --data-dir /path/to/pokemon-tcg-data
 *
 * Prerequisites:
 *   1. Clone the data repo:
 *        git clone https://github.com/PokemonTCG/pokemon-tcg-data
 *   2. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file
 *      (the service role key bypasses RLS — never ship it to the client)
 *   3. Run the SQL migration (scripts/001_tcg_card_tables.sql) in Supabase first
 *   4. Run this script: node scripts/import-cards.mjs --data-dir ../pokemon-tcg-data
 */

import fs   from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.')
  console.error('  SUPABASE_URL — from Supabase → Settings → API → Project URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY — from Supabase → Settings → API → service_role (secret)')
  process.exit(1)
}

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const dirArg  = args[args.indexOf('--data-dir') + 1]
const onlySets = args.includes('--sets-only')
const onlyPrices = args.includes('--prices-only')
const setFilter = args[args.indexOf('--set') + 1]  // import a single set: --set base1

if (!dirArg) {
  console.error('Usage: node scripts/import-cards.mjs --data-dir /path/to/pokemon-tcg-data')
  process.exit(1)
}

const DATA_DIR  = path.resolve(dirArg)
const SETS_FILE = path.join(DATA_DIR, 'sets', 'en.json')
const CARDS_DIR = path.join(DATA_DIR, 'cards', 'en')

if (!fs.existsSync(SETS_FILE)) {
  console.error(`ERROR: Could not find ${SETS_FILE}`)
  console.error('Make sure --data-dir points to the root of the pokemon-tcg-data clone.')
  process.exit(1)
}

// ── Supabase client (service role — bypasses RLS) ─────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, {
  auth: { persistSession: false }
})

// ── WotC 1st Ed set IDs (from src/lib/sets.js) ────────────────────────────────
const WOTC_SET_IDS = new Set([
  'base1','base2','base3','base5','gym1','gym2',
  'neo1','neo2','neo3','neo4','ecard1','ecard2','ecard3'
])

// ── Helpers ───────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function upsertBatch(table, rows, conflict = 'id') {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflict, ignoreDuplicates: false })
  if (error) throw new Error(`[${table}] upsert error: ${error.message}`)
}

function parsePrices(tcgplayer) {
  const p = tcgplayer?.prices ?? {}
  return {
    normal_market:          p.normal?.market          ?? null,
    normal_mid:             p.normal?.mid             ?? null,
    normal_low:             p.normal?.low             ?? null,
    holofoil_market:        p.holofoil?.market        ?? null,
    holofoil_mid:           p.holofoil?.mid           ?? null,
    holofoil_low:           p.holofoil?.low           ?? null,
    reverse_holo_market:    p.reverseHolofoil?.market ?? null,
    reverse_holo_mid:       p.reverseHolofoil?.mid    ?? null,
    reverse_holo_low:       p.reverseHolofoil?.low    ?? null,
    first_ed_holo_market:   p['1stEditionHolofoil']?.market ?? null,
    first_ed_normal_market: p['1stEditionNormal']?.market   ?? null,
  }
}

function hasPrices(priceRow) {
  return Object.values(priceRow).some(v => v !== null)
}

// ── Step 1: Import sets ───────────────────────────────────────────────────────
async function importSets() {
  console.log('\n── Importing sets ───────────────────────────────────────')
  const rawSets = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'))
  const rows = rawSets.map(s => ({
    id:            s.id,
    name:          s.name,
    series:        s.series ?? null,
    printed_total: s.printedTotal ?? null,
    total:         s.total ?? null,
    release_date:  s.releaseDate ?? null,
    symbol_url:    s.images?.symbol ?? null,
    logo_url:      s.images?.logo   ?? null,
  }))

  for (const batch of chunk(rows, 200)) {
    await upsertBatch('tcg_sets', batch)
    process.stdout.write('.')
  }
  console.log(`\nDone. ${rows.length} sets imported.`)
  return new Map(rawSets.map(s => [s.id, s]))
}

// ── Step 2: Import cards (+ prices) ──────────────────────────────────────────
async function importCards(setsMap) {
  console.log('\n── Importing cards ──────────────────────────────────────')
  const setFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => !setFilter || f === `${setFilter}.json`)

  let totalCards = 0
  let totalPrices = 0

  for (const file of setFiles) {
    const setId   = path.basename(file, '.json')
    const setMeta = setsMap.get(setId)
    const setName = setMeta?.name ?? setId
    const releaseDate = setMeta?.releaseDate ?? null

    const raw = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), 'utf8'))

    const cardRows  = []
    const priceRows = []

    for (const card of raw) {
      cardRows.push({
        id:           card.id,
        name:         card.name,
        supertype:    card.supertype       ?? null,
        subtypes:     card.subtypes        ?? [],
        hp:           card.hp              ?? null,
        types:        card.types           ?? [],
        evolves_from: card.evolvesFrom     ?? null,
        number:       card.number          ?? null,
        artist:       card.artist          ?? null,
        rarity:       card.rarity          ?? null,
        flavor_text:  card.flavorText      ?? null,
        set_id:       setId,
        set_name:     setName,
        series:       setMeta?.series      ?? null,
        release_date: releaseDate,
        image_small:  card.images?.small   ?? null,
        image_large:  card.images?.large   ?? null,
        is_wotc:      WOTC_SET_IDS.has(setId),
      })

      if (!onlySets) {
        const prices = parsePrices(card.tcgplayer)
        if (hasPrices(prices)) {
          priceRows.push({ card_id: card.id, ...prices, updated_at: new Date().toISOString() })
        }
      }
    }

    // Upsert cards
    for (const batch of chunk(cardRows, 500)) {
      await upsertBatch('tcg_cards', batch)
    }
    totalCards += cardRows.length

    // Upsert prices
    if (priceRows.length) {
      for (const batch of chunk(priceRows, 500)) {
        await upsertBatch('tcg_prices', batch, 'card_id')
      }
      totalPrices += priceRows.length
    }

    console.log(`  ✓ ${setId.padEnd(12)} ${cardRows.length} cards  ${priceRows.length} prices`)
  }

  console.log(`\nDone. ${totalCards} cards, ${totalPrices} price rows imported.`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('PokePop Card Import')
console.log(`Data directory: ${DATA_DIR}`)
console.log(`Supabase URL:   ${SUPABASE_URL}`)
if (setFilter)    console.log(`Set filter:     ${setFilter}`)
if (onlySets)     console.log('Mode: sets only')
if (onlyPrices)   console.log('Mode: prices only')
console.log()

const setsMap = await importSets()
if (!onlySets) await importCards(setsMap)

console.log('\nImport complete.')
