#!/usr/bin/env node
/**
 * PokePop – Bulk Price Refresh Script
 *
 * Fetches current TCGPlayer prices for all cards in our Supabase DB
 * by paging through the pokemontcg.io API (250 cards per request).
 * Falls back to eBay sold-listing averages for cards with no TCGPlayer price.
 *
 * Usage:
 *   node scripts/refresh-prices.mjs
 *   node scripts/refresh-prices.mjs --set base1        # single set only
 *   node scripts/refresh-prices.mjs --no-ebay          # skip eBay fallback
 *   node scripts/refresh-prices.mjs --stale-only       # only cards with no price / > 7 days old
 *
 * Prerequisites:
 *   VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env
 *   VITE_TCG_API_KEY  — pokemontcg.io key (20 000 req/day free, enough for all 20k cards)
 *   EBAY_APP_ID       — optional, for eBay fallback (free eBay developer account)
 *
 * Runtime: ~5–8 min for all 20k cards with a TCG API key (rate-limited to 30 req/s).
 */

import fs   from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env ─────────────────────────────────────────────────────────────────
// Use process.cwd() so this works reliably on Windows regardless of how Node
// resolves import.meta.url paths. Run the script from the project root folder.
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const TCG_API_KEY     = process.env.VITE_TCG_API_KEY  || ''
const EBAY_APP_ID     = process.env.EBAY_APP_ID       || ''

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.')
  process.exit(1)
}

// ── Args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2)
const setIdx    = args.indexOf('--set')
const setFilter = setIdx !== -1 ? args[setIdx + 1] : null
const noEbay    = args.includes('--no-ebay')
const staleOnly = args.includes('--stale-only')

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, {
  auth: { persistSession: false }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// Build a tcg_prices row from a TCGPlayer prices object
function parseTcgPrices(prices, cardId) {
  const p = prices ?? {}
  const KNOWN = new Set(['normal','holofoil','reverseHolofoil','1stEditionHolofoil','1stEditionNormal'])
  const otherTier = Object.entries(p).find(([k, v]) => !KNOWN.has(k) && v?.market != null)
  const other = otherTier ? otherTier[1] : null

  return {
    card_id:                cardId,
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
    other_market:           other?.market ?? null,
    other_mid:              other?.mid    ?? null,
    other_low:              other?.low    ?? null,
    updated_at:             new Date().toISOString(),
  }
}

function hasPriceData(row) {
  return [
    row.normal_market, row.holofoil_market, row.reverse_holo_market,
    row.first_ed_holo_market, row.first_ed_normal_market, row.other_market
  ].some(v => v != null)
}

// ── eBay fallback ─────────────────────────────────────────────────────────────
// Uses the eBay Finding API (no OAuth required — just an App ID).
// Averages the 10 most recent sold listings in category 183454 (Pokémon cards).
// Sign up free at: https://developer.ebay.com/
async function fetchEbayAvgPrice(cardName, setName) {
  if (!EBAY_APP_ID) return null

  const keywords = encodeURIComponent(`pokemon ${cardName} ${setName} card`)
  const url = [
    'https://svcs.ebay.com/services/search/FindingService/v1',
    '?OPERATION-NAME=findCompletedItems',
    '&SERVICE-VERSION=1.0.0',
    `&SECURITY-APPNAME=${EBAY_APP_ID}`,
    '&RESPONSE-DATA-FORMAT=JSON',
    `&keywords=${keywords}`,
    '&categoryId=183454',
    '&itemFilter(0).name=SoldItemsOnly',
    '&itemFilter(0).value=true',
    '&itemFilter(1).name=Condition',
    '&itemFilter(1).value=3000',   // 3000 = Used (excludes PSA/BGS graded slabs)
    '&sortOrder=EndTimeSoonest',
    '&paginationInput.entriesPerPage=10',
  ].join('')

  try {
    const res  = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const items = json
      ?.findCompletedItemsResponse?.[0]
      ?.searchResult?.[0]
      ?.item ?? []

    if (!items.length) return null

    // Average the current prices of sold listings (in USD)
    const prices = items
      .map(i => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? '0'))
      .filter(p => p > 0)
    if (!prices.length) return null

    return prices.reduce((a, b) => a + b, 0) / prices.length
  } catch {
    return null
  }
}

// ── Step 1: Gather card IDs from our DB ───────────────────────────────────────
async function getCardIds() {
  let query = supabase.from('tcg_cards').select('id, name, set_name, set_id')
  if (setFilter) query = query.eq('set_id', setFilter)

  if (staleOnly) {
    // Get IDs that either have no price row or haven't been updated in 7+ days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: staleIds } = await supabase
      .from('tcg_prices')
      .select('card_id')
      .lt('updated_at', cutoff)
    const staleSet = new Set((staleIds ?? []).map(r => r.card_id))

    const { data: allCards } = await query
    return (allCards ?? []).filter(c => staleSet.has(c.id) || !staleSet.size)
  }

  const { data } = await query
  return data ?? []
}

// ── Step 2: Fetch prices from pokemontcg.io in batches ───────────────────────
// The API supports filtering by multiple IDs: q=id:base1-1 OR id:base1-2 …
// Max ~100 IDs per request to keep the URL within limits.
async function fetchTcgPricesForIds(cardIds) {
  const TCG_BATCH = 100
  const headers = TCG_API_KEY ? { 'X-Api-Key': TCG_API_KEY } : {}
  const results  = {}   // cardId → price row

  const batches = chunk(cardIds, TCG_BATCH)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const q = batch.map(id => `id:${id}`).join(' OR ')
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&select=id,tcgplayer&pageSize=${TCG_BATCH}`

    try {
      const res = await fetch(url, { headers })
      if (res.status === 429) {
        // Rate limited — wait 2s and retry this batch
        await sleep(2000)
        i--; continue
      }
      if (!res.ok) { process.stdout.write('!'); continue }

      const { data: cards } = await res.json()
      for (const card of (cards ?? [])) {
        const row = parseTcgPrices(card.tcgplayer?.prices, card.id)
        if (hasPriceData(row)) results[card.id] = row
      }
    } catch {
      process.stdout.write('x')
    }

    process.stdout.write('.')
    // Polite rate limiting: ~30 requests/second with API key, 1/s without
    await sleep(TCG_API_KEY ? 35 : 1000)
  }

  return results
}

// ── Step 3: eBay fallback for cards still missing prices ─────────────────────
async function addEbayFallbacks(cards, tcgPriceMap) {
  if (noEbay || !EBAY_APP_ID) return

  const missing = cards.filter(c => !tcgPriceMap[c.id])
  if (!missing.length) { console.log('\nNo cards need eBay fallback.'); return }

  console.log(`\nFetching eBay prices for ${missing.length} unpriced cards…`)
  let filled = 0

  for (const card of missing) {
    const avg = await fetchEbayAvgPrice(card.name, card.set_name)
    if (avg != null) {
      // Store as "other" tier since it's not a standard TCGPlayer tier
      tcgPriceMap[card.id] = {
        card_id:      card.id,
        other_market: parseFloat(avg.toFixed(2)),
        updated_at:   new Date().toISOString(),
      }
      filled++
    }
    await sleep(250)  // eBay Finding API limit: ~5 000 req/day
  }

  console.log(`eBay filled ${filled} / ${missing.length} cards.`)
}

// ── Step 4: Upsert to Supabase ────────────────────────────────────────────────
async function upsertPrices(priceRows) {
  for (const batch of chunk(priceRows, 500)) {
    const { error } = await supabase
      .from('tcg_prices')
      .upsert(batch, { onConflict: 'card_id', ignoreDuplicates: false })
    if (error) console.error('\nUpsert error:', error.message)
    else process.stdout.write('+')
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('PokePop – Bulk Price Refresh')
console.log(`Supabase URL:  ${SUPABASE_URL}`)
console.log(`TCG API key:   ${TCG_API_KEY ? '✓ set' : '✗ not set (rate-limited to 1 req/s)'}`)
console.log(`eBay App ID:   ${EBAY_APP_ID ? '✓ set' : '✗ not set (eBay fallback disabled)'}`)
if (setFilter)  console.log(`Set filter:    ${setFilter}`)
if (staleOnly)  console.log(`Mode:          stale-only (> 7 days old or no price)`)
if (noEbay)     console.log(`Mode:          no-ebay`)
console.log()

console.log('Fetching card list from Supabase…')
const cards = await getCardIds()
console.log(`→ ${cards.length} cards to process.\n`)

if (!cards.length) { console.log('Nothing to do.'); process.exit(0) }

console.log('Fetching TCGPlayer prices from pokemontcg.io…')
const cardIds     = cards.map(c => c.id)
const tcgPriceMap = await fetchTcgPricesForIds(cardIds)
console.log(`\n→ ${Object.keys(tcgPriceMap).length} cards have TCGPlayer prices.`)

await addEbayFallbacks(cards, tcgPriceMap)

const priceRows = Object.values(tcgPriceMap)
if (!priceRows.length) {
  console.log('\nNo price data to write. Check your TCG API key.')
  process.exit(0)
}

console.log(`\nWriting ${priceRows.length} price rows to Supabase…`)
await upsertPrices(priceRows)
console.log(`\n\nDone! ${priceRows.length} prices refreshed.`)
