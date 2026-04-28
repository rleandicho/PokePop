#!/usr/bin/env node
/**
 * PokePop – Targeted Set Importer (pokemontcg.io → Supabase)
 *
 * Fetches one or more sets directly from the pokemontcg.io API and upserts
 * them into tcg_cards + tcg_prices. Use this for sets missing from the local
 * pokemon-tcg-data GitHub clone (e.g. recent promos, Trick or Trade, etc.).
 *
 * Usage:
 *   node scripts/import-sets-from-api.mjs --set trt22
 *   node scripts/import-sets-from-api.mjs --set trt22 --set trt23 --set trt24
 *   node scripts/import-sets-from-api.mjs --set svp          # re-import to fill gaps
 *   node scripts/import-sets-from-api.mjs --list-sets        # print all available set IDs
 *
 * Known missing sets to import:
 *   trt22  — Trick or Trade BOOster Bundle 2022 (Halloween)
 *   trt23  — Trick or Trade BOOster Bundle 2023 (Halloween)
 *   trt24  — Trick or Trade BOOster Bundle 2024 (Halloween)
 *   svp    — Scarlet & Violet Black Star Promos (re-import to fill gaps)
 *   swshp  — SWSH Black Star Promos (re-import to fill gaps)
 *   bwp    — BW Black Star Promos (deck promos, re-import to fill gaps)
 *   xyp    — XY Black Star Promos (re-import to fill gaps)
 */

import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'
import { createClient }  from '@supabase/supabase-js'

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const TCG_API_KEY     = process.env.VITE_TCG_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, { auth: { persistSession: false } })
const TCG_HEADERS = TCG_API_KEY ? { 'X-Api-Key': TCG_API_KEY } : {}
const TCG_BASE    = 'https://api.pokemontcg.io/v2'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Parse args ────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const listSets = args.includes('--list-sets')
const setIds   = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set' && args[i + 1]) setIds.push(args[++i])
}

// ── List all available sets ───────────────────────────────────────────────────
if (listSets) {
  console.log('Fetching set list from pokemontcg.io…')
  const res  = await fetch(`${TCG_BASE}/sets?orderBy=releaseDate&pageSize=250`, { headers: TCG_HEADERS })
  const json = await res.json()
  const sets = (json.data ?? []).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
  console.log('\nAll available sets (newest first):\n')
  for (const s of sets) {
    console.log(`  ${s.id.padEnd(16)} ${s.name.padEnd(40)} ${s.releaseDate}  (${s.total} cards)`)
  }
  process.exit(0)
}

if (!setIds.length) {
  console.error('Usage: node scripts/import-sets-from-api.mjs --set <setId> [--set <setId> ...]')
  console.error('       node scripts/import-sets-from-api.mjs --list-sets')
  process.exit(1)
}

// ── Card row transformer ──────────────────────────────────────────────────────
const KNOWN_PRICE_KEYS = new Set(['normal','holofoil','reverseHolofoil','1stEditionHolofoil','1stEditionNormal'])

function transformCard(card, setMeta) {
  const p    = card.tcgplayer?.prices ?? {}
  const other = Object.entries(p).find(([k, v]) => !KNOWN_PRICE_KEYS.has(k) && v?.market != null)

  const hasTcgPrice = Object.values(p).some(v => v?.market != null)

  const cardRow = {
    id:           card.id,
    name:         card.name,
    english_name: card.name,
    card_language:'en',
    supertype:    card.supertype   ?? null,
    subtypes:     card.subtypes    ?? [],
    hp:           card.hp          ?? null,
    types:        card.types       ?? [],
    evolves_from: card.evolvesFrom ?? null,
    number:       card.number,
    artist:       card.artist      ?? null,
    rarity:       card.rarity      ?? null,
    flavor_text:  card.flavorText  ?? null,
    set_id:       card.set.id,
    set_name:     card.set.name,
    series:       card.set.series  ?? null,
    release_date: card.set.releaseDate ?? null,
    image_small:  card.images?.small ?? null,
    image_large:  card.images?.large ?? null,
    tcgplayer_url: card.tcgplayer?.url ?? null,
    is_wotc:      false,
  }

  const priceRow = hasTcgPrice ? {
    card_id:                card.id,
    price_source:           'tcgplayer',
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
    other_market:           other?.[1]?.market ?? null,
    other_mid:              other?.[1]?.mid    ?? null,
    other_low:              other?.[1]?.low    ?? null,
    updated_at:             new Date().toISOString(),
  } : null

  return { cardRow, priceRow }
}

// ── Fetch all cards in a set (handles pagination) ─────────────────────────────
async function fetchSetCards(setId) {
  const PAGE   = 250
  const cards  = []
  let   page   = 1

  while (true) {
    const url = `${TCG_BASE}/cards?q=set.id:${setId}&pageSize=${PAGE}&page=${page}&orderBy=number`
    const res = await fetch(url, { headers: TCG_HEADERS })
    if (!res.ok) {
      console.error(`  API error ${res.status} for set ${setId}`)
      break
    }
    const json = await res.json()
    const batch = json.data ?? []
    cards.push(...batch)
    if (batch.length < PAGE) break
    page++
    await sleep(TCG_API_KEY ? 100 : 1100)
  }
  return cards
}

// ── Upsert to Supabase ────────────────────────────────────────────────────────
async function upsertCards(cardRows) {
  for (const batch of chunk(cardRows, 200)) {
    const { error } = await supabase.from('tcg_cards').upsert(batch, { onConflict: 'id' })
    if (error) console.error('  Card upsert error:', error.message)
  }
}

async function upsertPrices(priceRows) {
  for (const batch of chunk(priceRows, 200)) {
    const { error } = await supabase.from('tcg_prices').upsert(batch, { onConflict: 'card_id' })
    if (error) console.error('  Price upsert error:', error.message)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('PokePop – Set Importer (pokemontcg.io → Supabase)')
console.log(`TCG API key: ${TCG_API_KEY ? '✓ set (20k/day limit)' : '✗ not set (100/day limit — add VITE_TCG_API_KEY)'}`)
console.log(`Sets to import: ${setIds.join(', ')}\n`)

for (const setId of setIds) {
  console.log(`── Importing set: ${setId} ──────────────────────────────`)

  // First verify the set exists
  const setRes  = await fetch(`${TCG_BASE}/sets/${setId}`, { headers: TCG_HEADERS })
  if (!setRes.ok) {
    console.error(`  Set "${setId}" not found on pokemontcg.io (HTTP ${setRes.status})`)
    console.error(`  Run with --list-sets to see all valid set IDs`)
    continue
  }
  const { data: setMeta } = await setRes.json()
  console.log(`  Name:     ${setMeta.name}`)
  console.log(`  Series:   ${setMeta.series}`)
  console.log(`  Released: ${setMeta.releaseDate}`)
  console.log(`  Cards:    ${setMeta.total}`)
  console.log(`  Fetching cards…`)

  const apiCards = await fetchSetCards(setId)
  console.log(`  Fetched ${apiCards.length} cards from API`)

  const cardRows  = []
  const priceRows = []
  let   priced    = 0

  for (const card of apiCards) {
    const { cardRow, priceRow } = transformCard(card, setMeta)
    cardRows.push(cardRow)
    if (priceRow) { priceRows.push(priceRow); priced++ }
  }

  console.log(`  Upserting ${cardRows.length} cards (${priced} with TCGPlayer prices)…`)
  await upsertCards(cardRows)
  if (priceRows.length) await upsertPrices(priceRows)

  console.log(`  ✓ Done: ${setId} (${setMeta.name})\n`)
  await sleep(500)
}

console.log('All sets imported. Run refresh-prices.mjs --stale-only to fill any remaining price gaps.')
