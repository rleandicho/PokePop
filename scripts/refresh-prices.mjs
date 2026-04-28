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

import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'
import { createClient }  from '@supabase/supabase-js'

// ── Load .env ─────────────────────────────────────────────────────────────────
// fileURLToPath handles the Windows C:/ prefix correctly in ESM modules.
// This finds .env relative to the script file itself (scripts/../.env)
// regardless of which directory the user runs the command from.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
const envKeysFound = []
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const trimmed = line.replace(/\r$/, '')   // strip Windows CRLF
    const m = trimmed.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      envKeysFound.push(m[1])
    }
  }
}

const SUPABASE_URL      = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const TCG_API_KEY       = process.env.VITE_TCG_API_KEY  || ''
const EBAY_APP_ID       = process.env.EBAY_APP_ID       || ''  // legacy Finding API (unused)
const EBAY_CLIENT_ID    = process.env.EBAY_CLIENT_ID    || ''
const EBAY_CLIENT_SECRET= process.env.EBAY_CLIENT_SECRET|| ''

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('\nERROR: Missing Supabase credentials.')
  console.error(`  .env path checked: ${envPath}`)
  console.error(`  .env exists:       ${fs.existsSync(envPath)}`)
  console.error(`  Keys found in .env: ${envKeysFound.join(', ') || '(none)'}`)
  console.error(`  SUPABASE_URL:      ${SUPABASE_URL ? '✓ found' : '✗ missing (need SUPABASE_URL or VITE_SUPABASE_URL)'}`)
  console.error(`  SUPABASE_KEY:      ${SUPABASE_SVCKEY ? '✓ found' : '✗ missing (need SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY)'}`)
  console.error('\nFix: make sure your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
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
    other_market:           other?.market ?? null,
    other_mid:              other?.mid    ?? null,
    other_low:              other?.low    ?? null,
    ebay_market:            null,
    updated_at:             new Date().toISOString(),
  }
}

function hasPriceData(row) {
  return [
    row.normal_market, row.holofoil_market, row.reverse_holo_market,
    row.first_ed_holo_market, row.first_ed_normal_market, row.other_market
  ].some(v => v != null)
}

// ── eBay Browse API fallback ──────────────────────────────────────────────────
// Uses the eBay Browse API (active listings) — the modern replacement for the
// deprecated Finding API. Returns median asking price of ungraded listings.
// Active listings ≠ sold prices, but for most cards they track closely.
//
// Prerequisites (.env):
//   EBAY_CLIENT_ID     — eBay developer App Client ID
//   EBAY_CLIENT_SECRET — eBay developer App Client Secret
//   (Free account at https://developer.ebay.com/ → My Account → Application Keys)

let _ebayToken     = null
let _ebayTokenExp  = 0

async function getEbayToken() {
  if (_ebayToken && Date.now() < _ebayTokenExp - 60_000) return _ebayToken
  const creds = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64')
  const res   = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })
  if (!res.ok) { console.error('\neBay token error:', res.status); return null }
  const json     = await res.json()
  _ebayToken    = json.access_token
  _ebayTokenExp = Date.now() + (json.expires_in ?? 7200) * 1000
  return _ebayToken
}

async function fetchEbayAvgPrice(cardName, setName) {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return null

  const token = await getEbayToken()
  if (!token) return null

  // Include set name for uniquely-named sets (custom/JP sets), card name only for standard sets
  const query = encodeURIComponent(`${cardName} ${setName} pokemon card`)
  const url   = `https://api.ebay.com/buy/browse/v1/item_summary/search` +
    `?q=${query}&category_ids=183454&limit=20` +
    `&filter=buyingOptions%3A%7BFIXED_PRICE%7CAUCTION%7D`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    })
    if (res.status === 429) { await sleep(5000); return null }
    if (!res.ok) {
      if (process.env.EBAY_DEBUG) console.error('\neBay Browse API', res.status, await res.text())
      return null
    }
    const json  = await res.json()
    const items = json.itemSummaries ?? []
    if (!items.length) return null

    const GRADE_RE = /\b(PSA|BGS|CGC|SGC)\b/i
    const rawPrices = items
      .filter(i => !GRADE_RE.test(i.title ?? ''))
      .map(i => parseFloat(i.price?.value ?? '0'))
      .filter(p => p > 0)

    if (rawPrices.length < 3) return null

    const sorted = [...rawPrices].sort((a, b) => a - b)
    const mid    = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  } catch {
    return null
  }
}

// ── Step 1: Gather card IDs from our DB ───────────────────────────────────────
async function getAllCards(baseQuery) {
  // PostgREST caps responses at 1000 rows. Page through until we get everything.
  const PAGE = 1000
  const all  = []
  let   from = 0
  while (true) {
    const { data, error } = await baseQuery.range(from, from + PAGE - 1)
    if (error) { console.error('getCardIds page error:', error.message); break }
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break   // last page
    from += PAGE
  }
  return all
}

async function getCardIds() {
  const buildQuery = () => {
    let q = supabase.from('tcg_cards').select('id, name, set_name, set_id')
    if (setFilter) q = q.eq('set_id', setFilter)
    return q
  }

  if (staleOnly) {
    // Get IDs that either have no price row or haven't been updated in 7+ days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: staleIds } = await supabase
      .from('tcg_prices')
      .select('card_id')
      .lt('updated_at', cutoff)
    const staleSet = new Set((staleIds ?? []).map(r => r.card_id))

    const allCards = await getAllCards(buildQuery())
    return allCards.filter(c => staleSet.has(c.id) || !staleSet.size)
  }

  return getAllCards(buildQuery())
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

// ── Concurrency pool — run up to `limit` async tasks at once ─────────────────
async function poolMap(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ── Step 3: eBay fallback for cards still missing prices ─────────────────────
async function addEbayFallbacks(cards, tcgPriceMap) {
  if (noEbay || !EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return

  const missing = cards.filter(c => !tcgPriceMap[c.id])
  if (!missing.length) { console.log('\nNo cards need eBay fallback.'); return }

  console.log(`\nFetching eBay prices for ${missing.length} unpriced cards (5 concurrent)…`)
  let filled = 0
  let done   = 0

  await poolMap(missing, 5, async (card) => {
    const avg = await fetchEbayAvgPrice(card.name, card.set_name)
    done++
    if (avg != null) {
      tcgPriceMap[card.id] = {
        card_id:      card.id,
        price_source: 'ebay',
        ebay_market:  parseFloat(avg.toFixed(2)),
        updated_at:   new Date().toISOString(),
      }
      filled++
    }
    if (done % 100 === 0 || done === missing.length) {
      process.stdout.write(`\r  ${done}/${missing.length} checked, ${filled} filled…`)
    }
  })

  console.log(`\neBay filled ${filled} / ${missing.length} cards.`)
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
console.log(`eBay Browse:   ${(EBAY_CLIENT_ID && EBAY_CLIENT_SECRET) ? '✓ Client ID + Secret set' : '✗ not set (add EBAY_CLIENT_ID + EBAY_CLIENT_SECRET)'}`)
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
