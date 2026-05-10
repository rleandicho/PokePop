#!/usr/bin/env node
/**
 * PokePop – Import Missing Energy Cards
 *
 * Fetches Energy-supertype cards from the pokemontcg.io API for any SV set
 * that is missing them, then upserts into tcg_cards + tcg_prices.
 *
 * Usage:
 *   node scripts/import-missing-energies.mjs [--dry-run] [--set sv7]
 *
 * Options:
 *   --dry-run   Print what would be imported without writing to the DB
 *   --set <id>  Only process a specific set (e.g. --set sv7)
 *   --all       Process all SV sets (not just the ones missing energies)
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// ── Load env ──────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                     || process.env.VITE_SUPABASE_ANON_KEY  // fallback when RLS allows inserts
const TCG_API_KEY     = process.env.VITE_TCG_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.')
  process.exit(1)
}

const args   = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const ALL_SETS = args.includes('--all')
const setArg   = args.includes('--set') ? args[args.indexOf('--set') + 1] : null

const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, {
  auth: { persistSession: false }
})

// ── Sets to process (missing energies identified by DB audit) ─────────────────
// These had 0 energy cards after full import runs.
const MISSING_ENERGY_SETS = ['sv4pt5', 'sv7', 'sv8pt5']

// All SV sets (used when --all is passed)
const ALL_SV_SETS = [
  'sv1','sv2','sv3','sv3pt5','sv4','sv4pt5','sv5','sv6','sv6pt5',
  'sv7','sv8','sv8pt5','sv9','sv10','sve','svp',
]

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Fetch energy cards from pokemontcg.io API ─────────────────────────────────
async function fetchEnergyCardsForSet(setId) {
  const headers = { 'Content-Type': 'application/json' }
  if (TCG_API_KEY) headers['X-Api-Key'] = TCG_API_KEY

  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}+supertype:Energy&pageSize=250`
  const res  = await fetch(url, { headers })

  if (!res.ok) {
    console.error(`  [${setId}] API error ${res.status}: ${await res.text()}`)
    return []
  }

  const json = await res.json()
  return json.data ?? []
}

// ── Fetch set metadata from pokemontcg.io API ─────────────────────────────────
async function fetchSetMeta(setId) {
  const headers = {}
  if (TCG_API_KEY) headers['X-Api-Key'] = TCG_API_KEY
  const res = await fetch(`https://api.pokemontcg.io/v2/sets/${setId}`, { headers })
  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? null
}

// ── Transform API card → DB row ───────────────────────────────────────────────
function toCardRow(card, setMeta) {
  return {
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
    set_id:       card.set?.id         ?? null,
    set_name:     card.set?.name       ?? setMeta?.name ?? null,
    series:       card.set?.series     ?? setMeta?.series ?? null,
    release_date: card.set?.releaseDate ?? setMeta?.releaseDate ?? null,
    image_small:  card.images?.small   ?? null,
    image_large:  card.images?.large   ?? null,
    is_wotc:      false,
  }
}

function toPriceRow(card) {
  const p = card.tcgplayer?.prices ?? {}
  const prices = {
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
  const hasAny = Object.values(prices).some(v => v !== null)
  return hasAny ? { card_id: card.id, ...prices, updated_at: new Date().toISOString() } : null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const setsToProcess = setArg
    ? [setArg]
    : ALL_SETS
    ? ALL_SV_SETS
    : MISSING_ENERGY_SETS

  console.log(`\nPokePop – Import Missing Energy Cards${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`Sets to process: ${setsToProcess.join(', ')}\n`)

  let totalImported = 0
  let totalSkipped  = 0

  for (const setId of setsToProcess) {
    console.log(`── ${setId} ────────────────────────────`)

    // Check existing energy count in DB
    const { count: existing } = await supabase
      .from('tcg_cards')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId)
      .eq('supertype', 'Energy')

    console.log(`  Existing energy cards in DB: ${existing ?? 0}`)

    // Fetch from API
    const apiCards = await fetchEnergyCardsForSet(setId)
    console.log(`  Energy cards from API: ${apiCards.length}`)

    if (apiCards.length === 0) {
      console.log('  Nothing to import.')
      totalSkipped++
      continue
    }

    // Show what we'd import
    for (const c of apiCards) {
      const flag = (existing ?? 0) > 0 ? '  (update)' : '  (new)'
      console.log(`  ${c.id.padEnd(20)} ${c.name.padEnd(30)} ${c.rarity ?? ''}${flag}`)
    }

    if (DRY_RUN) {
      console.log('  [DRY RUN] Skipping DB write.')
      totalImported += apiCards.length
      continue
    }

    // Fetch set meta for series/releaseDate if needed
    const setMeta = await fetchSetMeta(setId)

    // Build rows
    const cardRows  = apiCards.map(c => toCardRow(c, setMeta))
    const priceRows = apiCards.map(toPriceRow).filter(Boolean)

    // Upsert cards
    for (const batch of chunk(cardRows, 100)) {
      const { error } = await supabase
        .from('tcg_cards')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
      if (error) { console.error(`  [tcg_cards] upsert error: ${error.message}`); continue }
    }
    console.log(`  Upserted ${cardRows.length} card rows.`)

    // Upsert prices
    if (priceRows.length) {
      for (const batch of chunk(priceRows, 100)) {
        const { error } = await supabase
          .from('tcg_prices')
          .upsert(batch, { onConflict: 'card_id', ignoreDuplicates: false })
        if (error) console.error(`  [tcg_prices] upsert error: ${error.message}`)
      }
      console.log(`  Upserted ${priceRows.length} price rows.`)
    }

    totalImported += cardRows.length

    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n── Done ────────────────────────────────`)
  console.log(`Total energy cards imported: ${totalImported}`)
  if (totalSkipped) console.log(`Sets with no API data:       ${totalSkipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })
