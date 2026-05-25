#!/usr/bin/env node
/**
 * PokePop – TCGDex Price Seeder
 *
 * Pulls Cardmarket (EUR) and TCGPlayer (USD) prices from the TCGDex API and
 * writes them into tcg_prices.cardmarket_avg / _low / _trend / _avg30.
 *
 * ID MAPPING
 * ──────────
 * TCGDex card IDs:  {tcgdexSetId}-{localId}   e.g. "swsh1-1", "E3-136"
 * Our card IDs:
 *   English  →  set_id is already the bare TCGDex set ID  (e.g. "swsh1")
 *               card id = "{set_id}-{number}"             (e.g. "swsh1-1")
 *   Foreign  →  set_id is "{lang}-{tcgdexSetId}"         (e.g. "ja-E3")
 *               strip the lang prefix to get TCGDex set   (e.g. "E3")
 *               card id = "{lang}-{tcgdexSetId}-{number}" (e.g. "ja-E3-136")
 *
 * USAGE
 * ─────
 *   node scripts/seed-tcgdex-prices.mjs                   # all languages
 *   node scripts/seed-tcgdex-prices.mjs --lang fr         # French only
 *   node scripts/seed-tcgdex-prices.mjs --lang en         # English gaps only
 *   node scripts/seed-tcgdex-prices.mjs --lang ja --set E3
 *   node scripts/seed-tcgdex-prices.mjs --dry-run         # preview, no writes
 *   node scripts/seed-tcgdex-prices.mjs --force           # refresh even if priced
 *
 * WHAT GETS WRITTEN
 * ─────────────────
 *   cardmarket_avg    – current average EUR price  (primary display price)
 *   cardmarket_low    – lowest EUR listing
 *   cardmarket_trend  – 30-day trend EUR price (smoothed, good for valuation)
 *   cardmarket_avg30  – 30-day rolling average EUR
 *
 *   For English cards missing TCGPlayer prices, also writes:
 *   normal_market / holofoil_market from TCGDex's TCGPlayer data.
 *
 *   price_source is set to "cardmarket" when Cardmarket is the only source,
 *   or left as-is when TCGPlayer data already exists.
 */

import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'
import { createClient }  from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, { auth: { persistSession: false } })

// ── CLI args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2)
const langArg   = args[args.indexOf('--lang')  + 1] || null
const setArg    = args[args.indexOf('--set')   + 1] || null
const dryRun    = args.includes('--dry-run')
const force     = args.includes('--force')   // refresh cards that already have prices

// Languages to process (in order of volume / priority)
const ALL_LANGS = ['en', 'fr', 'de', 'ja', 'zh-tw', 'zh-cn', 'ko', 'es', 'it', 'pt']
const LANGS     = langArg ? [langArg] : ALL_LANGS

const BASE      = 'https://api.tcgdex.net/v2'
const CONCURRENCY = 10   // parallel card-detail fetches per set
const SET_PAUSE   = 80   // ms between sets to stay polite

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) { await sleep(300 * (i + 1)); continue }
      return await res.json()
    } catch {
      await sleep(300 * (i + 1))
    }
  }
  return null
}

async function poolMap(items, limit, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// ── ID mapping ────────────────────────────────────────────────────────────────
// Given a card row from our DB, return the TCGDex set ID (without lang prefix)
// and the TCGDex API language code to use when calling the API.
function tcgdexIds(card) {
  const lang   = card.card_language   // e.g. "fr", "ja", "en"
  const setId  = card.set_id          // e.g. "swsh1" (en) or "fr-swsh1" (fr)
  const number = card.number          // e.g. "1", "136"

  // Foreign cards seeded by seed-tcgdex.mjs have set_id = "{lang}-{rawSetId}"
  // English cards have set_id = "{rawSetId}" with no prefix
  const rawSetId = setId.startsWith(`${lang}-`) ? setId.slice(lang.length + 1) : setId

  const tcgdexCardId = `${rawSetId}-${number}`
  const apiLang      = lang  // TCGDex uses the same language codes we use

  return { rawSetId, tcgdexCardId, apiLang }
}

// ── Extract prices from a TCGDex card response ────────────────────────────────
function extractPrices(card) {
  const cm  = card?.pricing?.cardmarket
  const tcp = card?.pricing?.tcgplayer

  const cmPrices = cm ? {
    cardmarket_avg:   cm.avg    ?? null,
    cardmarket_low:   cm.low    ?? null,
    cardmarket_trend: cm.trend  ?? null,
    cardmarket_avg30: cm.avg30  ?? null,
  } : {}

  // For English cards missing TCGPlayer data, pull from TCGDex's TCGPlayer mirror.
  // These are the same prices pokemontcg.io serves, just an alternative fetch path.
  const tcpPrices = {}
  if (tcp) {
    const holo    = tcp.holofoil  ?? tcp['holofoil']
    const normal  = tcp.normal    ?? tcp['normal']
    const reverse = tcp.reverseHolofoil ?? tcp['reverseHolofoil']
    if (holo?.marketPrice)    tcpPrices.holofoil_market   = holo.marketPrice
    if (holo?.midPrice)       tcpPrices.holofoil_mid      = holo.midPrice
    if (holo?.lowPrice)       tcpPrices.holofoil_low      = holo.lowPrice
    if (normal?.marketPrice)  tcpPrices.normal_market     = normal.marketPrice
    if (normal?.midPrice)     tcpPrices.normal_mid        = normal.midPrice
    if (normal?.lowPrice)     tcpPrices.normal_low        = normal.lowPrice
    if (reverse?.marketPrice) tcpPrices.reverse_holo_market = reverse.marketPrice
  }

  return { cmPrices, tcpPrices, hasCm: !!cm, hasTcp: !!tcp }
}

// ── Load our cards for a given set from Supabase ──────────────────────────────
async function loadDbCards(lang, rawSetId) {
  // English: set_id = rawSetId directly
  // Foreign: set_id = "{lang}-{rawSetId}"
  const dbSetId = lang === 'en' ? rawSetId : `${lang}-${rawSetId}`

  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id, number, set_id, card_language')
    .eq('set_id', dbSetId)
  if (error) return []
  return data ?? []
}

// ── Load existing price rows so we know which cards already have CM prices ────
async function loadExistingPrices(cardIds) {
  if (!cardIds.length) return new Set()
  const { data } = await supabase
    .from('tcg_prices')
    .select('card_id, cardmarket_avg')
    .in('card_id', cardIds)
  return new Set((data ?? []).filter(r => r.cardmarket_avg != null).map(r => r.card_id))
}

// ── Upsert a batch of price rows ──────────────────────────────────────────────
async function upsertPrices(rows) {
  if (!rows.length || dryRun) return 0
  const { error } = await supabase
    .from('tcg_prices')
    .upsert(rows, { onConflict: 'card_id', ignoreDuplicates: false })
  if (error) { console.error('\n  upsert error:', error.message); return 0 }
  return rows.length
}

// ── Process one set ───────────────────────────────────────────────────────────
async function processSet(lang, rawSetId, setName) {
  // 1. Load our DB cards for this set
  const dbCards = await loadDbCards(lang, rawSetId)
  if (!dbCards.length) return { priced: 0, skipped: 0, missing: 0 }

  // 2. Optionally skip cards that already have Cardmarket prices
  const cardIds = dbCards.map(c => c.id)
  const alreadyPriced = force ? new Set() : await loadExistingPrices(cardIds)

  const toProcess = dbCards.filter(c => !alreadyPriced.has(c.id))
  if (!toProcess.length) return { priced: 0, skipped: dbCards.length, missing: 0 }

  // 3. Fetch TCGDex card details in parallel and collect price rows
  const priceRows = []
  let missing = 0

  await poolMap(toProcess, CONCURRENCY, async (card) => {
    const { tcgdexCardId, apiLang } = tcgdexIds(card)
    const tcgCard = await fetchJson(`${BASE}/${apiLang}/cards/${tcgdexCardId}`)

    if (!tcgCard) { missing++; return }

    const { cmPrices, tcpPrices, hasCm, hasTcp } = extractPrices(tcgCard)
    if (!hasCm && !hasTcp) { missing++; return }

    const row = {
      card_id:    card.id,
      updated_at: new Date().toISOString(),
      ...cmPrices,
    }

    // For English cards: also write TCGPlayer prices from TCGDex if we have them
    // (fills the ~1,042 English cards that pokemontcg.io didn't price).
    // For non-English cards: TCGPlayer rarely prices them, skip to avoid zeros.
    if (lang === 'en' && hasTcp) Object.assign(row, tcpPrices)

    // Set price_source label
    if (hasCm && !hasTcp) row.price_source = 'cardmarket'
    else if (hasTcp)      row.price_source = 'tcgplayer'

    priceRows.push(row)
  })

  const written = await upsertPrices(priceRows)
  return { priced: written, skipped: alreadyPriced.size, missing }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – TCGDex Price Seeder${dryRun ? '  [DRY RUN]' : ''}`)
console.log(`Languages: ${LANGS.join(', ')}${setArg ? `  |  Set: ${setArg}` : ''}`)
console.log(`Force refresh: ${force ? 'yes' : 'no (skip already-priced cards)'}`)
console.log()

let grandTotal = { priced: 0, skipped: 0, missing: 0, sets: 0 }

for (const lang of LANGS) {
  console.log(`── ${lang.toUpperCase()} ──────────────────────────────────────`)

  // Fetch TCGDex set list for this language
  const tcgdexSets = await fetchJson(`${BASE}/${lang}/sets`)
  if (!tcgdexSets) { console.log('  No sets returned, skipping.\n'); continue }

  const setsToRun = setArg ? tcgdexSets.filter(s => s.id === setArg) : tcgdexSets
  if (!setsToRun.length) { console.log(`  Set "${setArg}" not found.\n`); continue }

  let langTotal = { priced: 0, skipped: 0, missing: 0 }

  for (const s of setsToRun) {
    process.stdout.write(`  [${s.id}] ${(s.name ?? s.id).padEnd(32).slice(0, 32)} `)

    const result = await processSet(lang, s.id, s.name)
    langTotal.priced  += result.priced
    langTotal.skipped += result.skipped
    langTotal.missing += result.missing
    grandTotal.sets++

    if (result.skipped && !result.priced) {
      process.stdout.write(`skip (${result.skipped} already priced)\n`)
    } else if (!result.priced && !result.skipped) {
      process.stdout.write(`— no cards in DB\n`)
    } else {
      const parts = []
      if (result.priced)  parts.push(`✓ ${result.priced} priced`)
      if (result.missing) parts.push(`${result.missing} no API data`)
      if (result.skipped) parts.push(`${result.skipped} skipped`)
      process.stdout.write(parts.join('  ') + '\n')
    }

    await sleep(SET_PAUSE)
  }

  console.log(`  → ${lang}: ${langTotal.priced} priced, ${langTotal.skipped} skipped, ${langTotal.missing} no price data\n`)
  grandTotal.priced  += langTotal.priced
  grandTotal.skipped += langTotal.skipped
  grandTotal.missing += langTotal.missing
}

console.log('════════════════════════════════════════')
console.log(`Sets processed : ${grandTotal.sets}`)
console.log(`Cards priced   : ${grandTotal.priced}`)
console.log(`Cards skipped  : ${grandTotal.skipped}`)
console.log(`No price data  : ${grandTotal.missing}`)
if (dryRun) console.log('\n(Dry run — nothing written to DB.)')
