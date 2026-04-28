#!/usr/bin/env node
/**
 * PokePop – PriceCharting Price Seeder
 *
 * Fetches market prices from PriceCharting.com for English cards that have no
 * TCGPlayer price. Stores results in tcg_prices (pricecharting_market column).
 *
 * Usage:
 *   node scripts/seed-pricecharting.mjs
 *   node scripts/seed-pricecharting.mjs --set base1          # single set
 *   node scripts/seed-pricecharting.mjs --limit 500          # first N unpriced cards
 *   node scripts/seed-pricecharting.mjs --refresh-all        # re-price everything, not just gaps
 *
 * Prerequisites (.env):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or VITE_SUPABASE_ANON_KEY)
 *   PRICECHARTING_API_KEY      — free key at https://www.pricecharting.com/api
 *
 * PriceCharting API:
 *   GET https://www.pricecharting.com/api/products?q={query}&id={key}
 *   Prices are returned in USD cents (integer). Divide by 100 for dollars.
 *   `loose-price` = ungraded raw card market price (what we want).
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

const SUPABASE_URL    = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const PC_API_KEY      = process.env.PRICECHARTING_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Missing Supabase credentials in .env')
  process.exit(1)
}
if (!PC_API_KEY) {
  console.error('ERROR: PRICECHARTING_API_KEY not set in .env')
  console.error('  Get a free key at https://www.pricecharting.com/api')
  process.exit(1)
}

// ── Args ──────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2)
const setIdx     = args.indexOf('--set');    const setFilter    = setIdx    !== -1 ? args[setIdx + 1]    : null
const limitIdx   = args.indexOf('--limit');  const limitFilter  = limitIdx  !== -1 ? parseInt(args[limitIdx + 1]) : null
const refreshAll = args.includes('--refresh-all')

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, { auth: { persistSession: false } })

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Set name normalisation ────────────────────────────────────────────────────
// PriceCharting prefixes most Pokémon sets with "Pokemon " and uses slightly
// different punctuation. This map covers the most common mismatches.
const SET_NAME_MAP = {
  'Scarlet & Violet':           'Pokemon Scarlet and Violet',
  'Sword & Shield':             'Pokemon Sword and Shield',
  'Sun & Moon':                 'Pokemon Sun and Moon',
  'XY':                         'Pokemon XY',
  'Black & White':              'Pokemon Black and White',
  'HeartGold & SoulSilver':     'Pokemon HeartGold SoulSilver',
  'Platinum':                   'Pokemon Platinum',
  'Diamond & Pearl':            'Pokemon Diamond and Pearl',
  'EX':                         'Pokemon EX',
  'Base Set':                   'Pokemon Base Set',
  'Jungle':                     'Pokemon Jungle',
  'Fossil':                     'Pokemon Fossil',
  'Team Rocket':                'Pokemon Team Rocket',
  'Gym Heroes':                 'Pokemon Gym Heroes',
  'Gym Challenge':              'Pokemon Gym Challenge',
  'Neo Genesis':                'Pokemon Neo Genesis',
  'Neo Discovery':              'Pokemon Neo Discovery',
  'Neo Revelation':             'Pokemon Neo Revelation',
  'Neo Destiny':                'Pokemon Neo Destiny',
  'Legendary Collection':       'Pokemon Legendary Collection',
  'Expedition Base Set':        'Pokemon Expedition',
  'Aquapolis':                  'Pokemon Aquapolis',
  'Skyridge':                   'Pokemon Skyridge',
}

function normSetName(name) {
  if (!name) return ''
  // Check direct map first
  for (const [key, val] of Object.entries(SET_NAME_MAP)) {
    if (name.startsWith(key)) return val
  }
  // Default: prefix "Pokemon " and strip extra punctuation
  return `Pokemon ${name}`.replace(/\s+/g, ' ').trim()
}

// ── Similarity scoring ────────────────────────────────────────────────────────
// Returns 0–1: 1 = exact match, 0 = no overlap.
// Used to pick the best PriceCharting product when search returns multiple hits.
function similarity(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  b = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  if (a === b) return 1
  const aWords = new Set(a.split(/\s+/))
  const bWords = new Set(b.split(/\s+/))
  const inter  = [...aWords].filter(w => bWords.has(w)).length
  return inter / Math.max(aWords.size, bWords.size)
}

// ── PriceCharting API call ────────────────────────────────────────────────────
async function searchPriceCharting(cardName, setName) {
  const query = encodeURIComponent(`${cardName} ${setName}`)
  const url   = `https://www.pricecharting.com/api/products?q=${query}&id=${PC_API_KEY}`

  try {
    const res = await fetch(url)
    if (res.status === 429) { await sleep(5000); return null }
    if (!res.ok) return null

    const json = await res.json()
    const products = json?.products ?? []
    if (!products.length) return null

    // Filter to Pokémon TCG products only
    const pokemonProducts = products.filter(p =>
      (p['console-name'] ?? '').toLowerCase().includes('pokemon')
    )
    if (!pokemonProducts.length) return null

    // Score each result: combine card name match + set name match
    const normSet = normSetName(setName)
    const scored  = pokemonProducts.map(p => {
      const nameSim = similarity(cardName, p['product-name'] ?? '')
      const setSim  = similarity(normSet,  p['console-name']  ?? '')
      return { p, score: nameSim * 0.6 + setSim * 0.4 }
    })
    scored.sort((a, b) => b.score - a.score)

    const best = scored[0]
    // Require a decent confidence threshold — name must match well
    if (best.score < 0.35) return null

    const loosePrice = best.p['loose-price']  // in cents
    if (!loosePrice || loosePrice <= 0) return null

    return {
      price: loosePrice / 100,   // convert cents → dollars
      id:    String(best.p.id),
    }
  } catch {
    return null
  }
}

// ── Load unpriced English cards from Supabase ─────────────────────────────────
async function getUnpricedCards() {
  const PAGE = 1000
  const all  = []
  let   from = 0

  while (true) {
    let q = supabase
      .from('tcg_cards')
      .select('id, name, set_name, set_id')
      .eq('card_language', 'en')

    if (setFilter) q = q.eq('set_id', setFilter)

    if (!refreshAll) {
      // Only cards with no TCGPlayer price — join against tcg_prices
      // We do this via a NOT IN on card IDs that already have TCGPlayer prices
      const { data: priced } = await supabase
        .from('tcg_prices')
        .select('card_id')
        .not('pricecharting_market', 'is', null)
      const pricedIds = new Set((priced ?? []).map(r => r.card_id))

      const { data: tcgPriced } = await supabase
        .from('tcg_prices')
        .select('card_id')
        .or('normal_market.not.is.null,holofoil_market.not.is.null,other_market.not.is.null')
      for (const r of tcgPriced ?? []) pricedIds.add(r.card_id)

      q = q.range(from, from + PAGE - 1)
      const { data, error } = await q
      if (error || !data?.length) break
      all.push(...data.filter(c => !pricedIds.has(c.id)))
      if (data.length < PAGE) break
      from += PAGE
    } else {
      q = q.range(from, from + PAGE - 1)
      const { data, error } = await q
      if (error || !data?.length) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  return limitFilter ? all.slice(0, limitFilter) : all
}

// ── Upsert to Supabase ────────────────────────────────────────────────────────
async function upsertPrices(rows) {
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase
      .from('tcg_prices')
      .upsert(batch, { onConflict: 'card_id', ignoreDuplicates: false })
    if (error) console.error('\nUpsert error:', error.message)
    else process.stdout.write('+')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('PokePop – PriceCharting Seeder')
console.log(`Supabase: ${SUPABASE_URL}`)
console.log(`PC key:   ${'*'.repeat(PC_API_KEY.length - 4)}${PC_API_KEY.slice(-4)}`)
if (setFilter)   console.log(`Set filter:   ${setFilter}`)
if (limitFilter) console.log(`Limit:        ${limitFilter}`)
if (refreshAll)  console.log(`Mode:         refresh-all`)
console.log()

console.log('Loading unpriced English cards…')
const cards = await getUnpricedCards()
console.log(`→ ${cards.length} cards to price.\n`)

if (!cards.length) {
  console.log('Nothing to do — all English cards already have prices.')
  process.exit(0)
}

const priceRows = []
let   hits      = 0
let   misses    = 0

for (let i = 0; i < cards.length; i++) {
  const card   = cards[i]
  const result = await searchPriceCharting(card.name, card.set_name)

  if (result) {
    priceRows.push({
      card_id:              card.id,
      price_source:         'pricecharting',
      pricecharting_market: result.price,
      pricecharting_id:     result.id,
      updated_at:           new Date().toISOString(),
    })
    hits++
    process.stdout.write('✓')
  } else {
    misses++
    process.stdout.write('·')
  }

  if ((i + 1) % 80 === 0) {
    process.stdout.write(`  ${i + 1}/${cards.length} (${hits} hits)\n`)
  }

  // PriceCharting free tier: be polite, ~3 req/s
  await sleep(350)

  // Flush every 200 hits to avoid losing progress on interruption
  if (priceRows.length >= 200) {
    process.stdout.write('\n[flushing…] ')
    await upsertPrices(priceRows.splice(0))
    process.stdout.write('\n')
  }
}

// Final flush
if (priceRows.length) {
  console.log('\n\nWriting remaining rows…')
  await upsertPrices(priceRows)
}

console.log(`\n\nDone!`)
console.log(`  Hits:   ${hits} / ${cards.length}`)
console.log(`  Misses: ${misses} / ${cards.length}`)
console.log(`  (Misses = not on PriceCharting, e.g. fan-made sets or very new promos)`)
