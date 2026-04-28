#!/usr/bin/env node
/**
 * PokePop – Limitless TCG Japanese Card Seeder
 *
 * Seeds Japanese Pokémon TCG sets from limitlesstcg.com for sets that are
 * not available in the TCGDex API (e.g. M2a "Mega Dream ex").
 *
 * Usage:
 *   node scripts/seed-limitless.mjs --set M2a
 *   node scripts/seed-limitless.mjs --set M2a --dry-run
 *   node scripts/seed-limitless.mjs --set M2a --release 2025-01-01
 *
 * Card IDs use format: ja-{limitlessSetId}-{cardNum}  e.g. ja-M2a-213
 * Images: https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/{SET}/{SET}_{NUM}_R_JP_SM.png
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
const setIdx     = args.indexOf('--set');     const setId  = setIdx  !== -1 ? args[setIdx  + 1] : null
const relIdx     = args.indexOf('--release'); const relDate = relIdx !== -1 ? args[relIdx + 1] : null
const dryRun     = args.includes('--dry-run')

if (!setId) {
  console.error('Usage: node scripts/seed-limitless.mjs --set <limitlessSetId> [--release YYYY-MM-DD] [--dry-run]')
  console.error('Example: node scripts/seed-limitless.mjs --set M2a --release 2025-01-01')
  process.exit(1)
}

const LIMITLESS_BASE = 'https://limitlesstcg.com/cards/jp'
const IMG_BASE       = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc'
const lang           = 'ja'
const dbSetId        = `${lang}-${setId}`

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 PokePop-Seeder/1.0' } })
      if (res.status === 404) return null
      if (!res.ok) { await sleep(500); continue }
      return await res.text()
    } catch {
      await sleep(500)
    }
  }
  return null
}

// Concurrency pool
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

// Build predictable image URLs — Limitless CDN always uses _R_JP suffix
function imgSmall(num) { return `${IMG_BASE}/${setId}/${setId}_${num}_R_JP_SM.png` }
function imgLarge(num) { return `${IMG_BASE}/${setId}/${setId}_${num}_R_JP_LG.png` }

// Parse Japanese card name from Limitless page title
// Title format: "{Name} - {Set} ({SetId}) #{Num} – Limitless"
function parseNameFromTitle(title) {
  if (!title) return null
  return title.split(' - ')[0].trim() || null
}

// Parse set name from title: "Mega Dream ex (M2a) – Limitless"
function parseSetNameFromTitle(title) {
  if (!title) return setId
  const m = title.match(/^(.+?)\s*\(/)
  return m ? m[1].trim() : setId
}

// Parse supertype from page body — look for first occurrence of Pokémon/Trainer/Energy
// in a card-type context (not navigation links)
function parseSupertypeFromHtml(html) {
  if (!html) return 'Pokémon'
  // Look for "Type: Pokémon/Trainer/Energy" or similar patterns
  const typeMatch = html.match(/>\s*(Pokémon|Trainer|Energy)\s*<\/(?:td|span|div)/i)
  if (typeMatch) return typeMatch[1]
  // Fallback: count occurrences — card type label appears prominently
  if ((html.match(/\bTrainer\b/g) || []).length > 2) return 'Trainer'
  if ((html.match(/\bEnergy\b/g) || []).length > 2) return 'Energy'
  return 'Pokémon'
}

// ── Step 1: fetch set page and extract card numbers ───────────────────────────
console.log(`\nPokePop – Limitless TCG Seeder${dryRun ? '  [DRY RUN]' : ''}`)
console.log(`Set: ${setId}  →  DB ID: ${dbSetId}`)
console.log()

process.stdout.write('Fetching set page… ')
const setHtml = await fetchHtml(`${LIMITLESS_BASE}/${setId}`)
if (!setHtml) { console.error(`\nSet not found on Limitless: ${setId}`); process.exit(1) }

// Parse set name from page <title>
const pageTitle = setHtml.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
const setName   = parseSetNameFromTitle(pageTitle)

// Extract all card numbers from href links
const cardNums = [...new Set(
  (setHtml.match(/href="\/cards\/jp\/[^"]+\/(\d+)"/g) || [])
    .map(m => parseInt(m.match(/\/(\d+)"$/)[1]))
)].sort((a, b) => a - b)

console.log(`Set: ${setName}  |  Cards found: ${cardNums.length}`)

if (!cardNums.length) {
  console.error('No cards found on set page.')
  process.exit(1)
}

// ── Step 2: fetch each card page for the Japanese name + supertype ─────────────
console.log('Fetching card details (this may take a minute)…')

const cardRows = Array(cardNums.length).fill(null)
let done = 0

await poolMap(cardNums, 12, async (num, idx) => {
  const html = await fetchHtml(`${LIMITLESS_BASE}/${setId}/${num}`)
  const title = html?.match(/<title>([^<]+)<\/title>/)?.[1] ?? null

  cardRows[idx] = {
    id:            `${dbSetId}-${num}`,
    name:          parseNameFromTitle(title) ?? `Card ${num}`,
    english_name:  null,   // filled later if needed
    card_language: lang,
    set_id:        dbSetId,
    set_name:      setName,
    series:        `JP-${setId.replace(/\d.*/, '')}`,  // rough series from set prefix
    release_date:  relDate ?? null,
    number:        String(num),
    supertype:     html ? parseSupertypeFromHtml(html) : 'Pokémon',
    subtypes:      [],
    types:         [],
    hp:            null,
    artist:        null,
    rarity:        null,
    flavor_text:   null,
    image_small:   imgSmall(num),
    image_large:   imgLarge(num),
  }

  done++
  if (done % 25 === 0 || done === cardNums.length) {
    process.stdout.write(`\r  ${done}/${cardNums.length} cards fetched…`)
  }

  // Polite pause every 10 requests
  if (done % 10 === 0) await sleep(80)
})

console.log()

const validCards = cardRows.filter(Boolean)
console.log(`→ ${validCards.length} cards ready to insert.`)

// Show a sample
if (validCards.length > 0) {
  const sample = validCards[Math.min(212, validCards.length - 1)]
  console.log(`  Sample: #${sample.number} "${sample.name}" [${sample.supertype}]`)
  console.log(`  Image:  ${sample.image_small}`)
}

if (dryRun) {
  console.log('\n[Dry run] No data written.')
  process.exit(0)
}

// ── Step 3: upsert set row ─────────────────────────────────────────────────────
const setRow = {
  id:            dbSetId,
  name:          setName,
  series:        `JP-${setId.replace(/\d.*/, '')}`,
  release_date:  relDate ?? null,
  total:         cardNums.length,
  printed_total: cardNums.length,
  symbol_url:    `https://s3.limitlesstcg.com/sets/jp/${setId}.png`,
  logo_url:      null,
}

const { error: setErr } = await supabase
  .from('tcg_sets')
  .upsert(setRow, { onConflict: 'id', ignoreDuplicates: false })

if (setErr) { console.error('Set upsert error:', setErr.message); process.exit(1) }
console.log('\n✓ Set row upserted.')

// ── Step 4: upsert card rows in batches of 200 ────────────────────────────────
process.stdout.write('Inserting cards… ')
let errors = 0

for (let i = 0; i < validCards.length; i += 200) {
  const batch = validCards.slice(i, i + 200)
  const { error } = await supabase
    .from('tcg_cards')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
  if (error) { console.error(`\nBatch ${i}-${i + 200} error:`, error.message); errors++ }
  else process.stdout.write('.')
}

console.log()
console.log()
console.log(`Done!`)
console.log(`  Set: ${dbSetId} (${setName})`)
console.log(`  Cards inserted: ${validCards.length}`)
if (errors) console.log(`  ⚠ ${errors} batch errors — some cards may not have been inserted`)
if (!relDate) console.log(`  ℹ Release date not set. Rerun with --release YYYY-MM-DD to set it.`)
console.log()
console.log(`  To fix English names later:`)
console.log(`    node scripts/seed-tcgdex.mjs --fix-en-names --lang ja`)
