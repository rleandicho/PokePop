#!/usr/bin/env node
/**
 * PokePop – TCGDex Foreign Card Seeder
 *
 * Imports foreign-language Pokémon TCG cards from the TCGDex API
 * (https://tcgdex.dev) into tcg_sets + tcg_cards.
 *
 * Supported languages: ja, zh-tw, zh-cn, ko, fr, de, es, it, pt, ru, nl, pl, id, th
 *
 * Usage:
 *   node scripts/seed-tcgdex.mjs --lang ja           # all Japanese sets
 *   node scripts/seed-tcgdex.mjs --lang zh-cn         # Chinese Simplified
 *   node scripts/seed-tcgdex.mjs --lang ja --dry-run  # preview only
 *   node scripts/seed-tcgdex.mjs --lang ko --set swsh3 # single set
 *
 * Card IDs use format: {lang}-{tcgdexSetId}-{localId}   e.g. ja-swsh3-136
 * Set  IDs use format: {lang}-{tcgdexSetId}              e.g. ja-swsh3
 * Images link directly to TCGDex CDN — no upload required.
 */

import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'
import { createClient }  from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_SVCKEY) { console.error('Missing Supabase credentials'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, { auth: { persistSession: false } })

// ── CLI args ──────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2)
const langIdx    = args.indexOf('--lang')
const setIdx     = args.indexOf('--set')
const lang       = langIdx !== -1 ? args[langIdx + 1] : null
const setFilter  = setIdx  !== -1 ? args[setIdx  + 1] : null
const dryRun     = args.includes('--dry-run')
const fixEnNames = args.includes('--fix-en-names')

if (!fixEnNames && !lang) {
  console.error('Usage: node scripts/seed-tcgdex.mjs --lang <code> [--set <setId>] [--dry-run]')
  console.error('       node scripts/seed-tcgdex.mjs --fix-en-names [--lang ja]')
  console.error('Supported: ja, zh-tw, zh-cn, ko, fr, de, es, it, pt, ru, nl, pl, id, th')
  process.exit(1)
}

const BASE = 'https://api.tcgdex.net/v2'

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) { await sleep(500); continue }
      return await res.json()
    } catch {
      await sleep(500)
    }
  }
  return null
}

// Concurrency pool — run up to `limit` async tasks at once
async function poolMap(items, limit, fn) {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// Map TCGDex category → pokemontcg.io supertype
function mapSupertype(category) {
  if (!category) return 'Pokémon'
  const c = category.toLowerCase()
  if (c === 'trainer') return 'Trainer'
  if (c === 'energy')  return 'Energy'
  return 'Pokémon'
}

// Build TCGDex CDN image URL
// Pattern: https://assets.tcgdex.net/{lang}/{serie}/{setId}/{localId}/{quality}.webp
function cdnUrl(lang, serieId, setId, localId, quality = 'low') {
  if (!serieId || !setId || !localId) return null
  return `https://assets.tcgdex.net/${lang}/${serieId}/${setId}/${localId}/${quality}.webp`
}

// ── Step 1: Fetch all sets for the language ───────────────────────────────────
async function fetchSets() {
  console.log(`Fetching sets for language: ${lang}…`)
  const sets = await fetchJson(`${BASE}/${lang}/sets`)
  if (!sets) { console.error('No sets returned — is the language code valid?'); process.exit(1) }
  const filtered = setFilter ? sets.filter(s => s.id === setFilter) : sets
  console.log(`→ ${filtered.length} sets to process.`)
  return filtered
}

// ── Step 2: Fetch EN name map for a set (localId → EN name) ──────────────────
// One extra request per set; allows cross-language search by English name.
async function fetchEnNames(setId) {
  const enSet = await fetchJson(`${BASE}/en/sets/${setId}`)
  if (!enSet?.cards) return {}
  const map = {}
  for (const card of enSet.cards) {
    if (card.localId && card.name) map[String(card.localId)] = card.name
  }
  return map
}

// ── Step 3: Fetch full card list for a set ────────────────────────────────────
async function fetchSetCards(setId) {
  const data = await fetchJson(`${BASE}/${lang}/sets/${setId}`)
  return data?.cards ?? []
}

// ── Step 4: Fetch full card detail ───────────────────────────────────────────
async function fetchCard(setId, localId) {
  return fetchJson(`${BASE}/${lang}/cards/${setId}-${localId}`)
}

// ── Fix EN Names mode ─────────────────────────────────────────────────────────
// Fetches English names card-by-card from TCGDex for all foreign cards
// where english_name is currently NULL.
// Tries: GET /v2/en/cards/{rawSetId}-{localId}
// The rawSetId is the TCGDex set ID without the lang prefix (e.g. "E3" from "ja-E3").
if (fixEnNames) {
  const targetLangs = lang ? [lang] : ['ja', 'zh-cn', 'zh-tw', 'ko']
  console.log(`\nPokePop – Fix EN Names`)
  console.log(`Languages: ${targetLangs.join(', ')}`)
  console.log()

  // Page through all foreign cards with null english_name
  const PAGE = 1000
  let allMissing = []
  for (const l of targetLangs) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, number, set_id, card_language')
        .eq('card_language', l)
        .is('english_name', null)
        .range(from, from + PAGE - 1)
      if (error) { console.error('DB error:', error.message); break }
      if (!data?.length) break
      allMissing.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  console.log(`→ ${allMissing.length} cards with missing english_name\n`)

  let filled = 0
  let done   = 0
  const updates = []

  await poolMap(allMissing, 20, async (card) => {
    // set_id format: "ja-E3" → rawSetId = "E3"
    const parts    = card.set_id.split('-')
    const rawSetId = parts.slice(1).join('-')   // everything after lang prefix
    const localId  = card.number

    const enCard = await fetchJson(`${BASE}/en/cards/${rawSetId}-${localId}`)
    done++

    if (enCard?.name) {
      updates.push({ id: card.id, english_name: enCard.name })
      filled++
    }

    if (done % 200 === 0 || done === allMissing.length) {
      process.stdout.write(`\r  ${done}/${allMissing.length} checked, ${filled} names found…`)
    }
  })

  console.log(`\n\nUpdating ${updates.length} records in DB…`)

  // Batch update — Supabase doesn't support bulk UPDATE by id, so upsert with just id + english_name
  for (let i = 0; i < updates.length; i += 200) {
    const batch = updates.slice(i, i + 200)
    const { error } = await supabase
      .from('tcg_cards')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
    if (error) console.error('\nUpsert error:', error.message)
    else process.stdout.write('.')
  }

  console.log(`\n\nDone! ${filled} english names backfilled out of ${allMissing.length} cards.`)
  process.exit(0)
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – TCGDex Foreign Card Seeder${dryRun ? '  [DRY RUN]' : ''}`)
console.log(`Language: ${lang}${setFilter ? `  |  Set filter: ${setFilter}` : ''}`)
console.log()

const sets = await fetchSets()
let totalCards = 0
let totalSets  = 0
let skipped    = 0

for (const setSummary of sets) {
  const setId   = setSummary.id
  const dbSetId = `${lang}-${setId}`

  process.stdout.write(`  [${setId}] ${setSummary.name ?? setId}… `)

  // Fetch full set + card list
  const [fullSet, enNames] = await Promise.all([
    fetchJson(`${BASE}/${lang}/sets/${setId}`),
    fetchEnNames(setId),
  ])

  if (!fullSet) { process.stdout.write('skip (no data)\n'); skipped++; continue }

  const cardSummaries = fullSet.cards ?? []
  if (!cardSummaries.length) { process.stdout.write('skip (0 cards)\n'); skipped++; continue }

  const serieId = fullSet.serie?.id ?? ''

  // Build tcg_sets row
  const setRow = {
    id:           dbSetId,
    name:         fullSet.name ?? setSummary.name,
    series:       fullSet.serie?.name ?? lang.toUpperCase(),
    release_date: fullSet.releaseDate ?? null,
    total:        fullSet.cardCount?.total ?? cardSummaries.length,
    printed_total: fullSet.cardCount?.official ?? null,
    symbol_url: fullSet.symbol ?? null,
    logo_url:   fullSet.logo   ?? null,
  }

  // Fetch all card details in parallel (up to 8 concurrent)
  const cardRows = []

  await poolMap(cardSummaries, 8, async (summary) => {
    const localId = String(summary.localId)
    const card    = await fetchCard(setId, localId)
    if (!card) return

    const enName = enNames[localId] ?? null

    cardRows.push({
      id:            `${lang}-${setId}-${localId}`,
      name:          card.name,
      english_name:  enName,
      card_language: lang,
      set_id:        dbSetId,
      set_name:      fullSet.name ?? setSummary.name,
      series:        fullSet.serie?.name ?? lang.toUpperCase(),
      release_date:  fullSet.releaseDate ?? null,
      number:        localId,
      supertype:     mapSupertype(card.category),
      subtypes:      card.stage  ? [card.stage]  : [],
      types:         card.types  ?? [],
      hp:            card.hp     ?? null,
      artist:        card.illustrator ?? null,
      rarity:        card.rarity ?? null,
      flavor_text:   card.description ?? null,
      // Only store a URL when TCGDex confirms the image exists (card.image from API).
      // cdnUrl() fallback produces a path that may 404 for sets not yet in TCGDex CDN.
      image_small:   card.image ? `${card.image}/low.webp`  : null,
      image_large:   card.image ? `${card.image}/high.webp` : null,
    })
  })

  process.stdout.write(`${cardRows.length} cards`)

  if (dryRun) {
    process.stdout.write('  (dry run)\n')
    totalCards += cardRows.length
    totalSets++
    continue
  }

  // Upsert set row
  const { error: setErr } = await supabase
    .from('tcg_sets')
    .upsert(setRow, { onConflict: 'id', ignoreDuplicates: false })
  if (setErr) { process.stdout.write(`  ✗ set error: ${setErr.message}\n`); continue }

  // Upsert card rows in chunks of 200
  let cardErrs = 0
  for (let i = 0; i < cardRows.length; i += 200) {
    const chunk = cardRows.slice(i, i + 200)
    const { error: cardErr } = await supabase
      .from('tcg_cards')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })
    if (cardErr) cardErrs++
  }

  process.stdout.write(cardErrs ? `  ✗ ${cardErrs} chunk error(s)\n` : '  ✓\n')
  totalCards += cardRows.length
  totalSets++

  // Polite pause between sets
  await sleep(100)
}

console.log()
console.log(`Done!`)
console.log(`  Sets processed:  ${totalSets}`)
console.log(`  Sets skipped:    ${skipped}`)
console.log(`  Cards imported:  ${totalCards}`)
if (dryRun) console.log('\n(Dry run — no data was written.)')
