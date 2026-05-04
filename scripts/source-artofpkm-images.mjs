#!/usr/bin/env node
/**
 * PokePop – ArtOfPKM Image Scraper
 *
 * Scrapes https://www.artofpkm.com/sets/{id}/cards for each Japanese set,
 * extracts card image URLs, matches them to our DB by TCGDex set ID + card
 * number (encoded in the filename), and updates image_small / image_large.
 *
 * The filename pattern on artofpkm mirrors TCGDex set IDs:
 *   pcg3002.png  → ja-pcg3-002
 *   neo1014.png  → ja-neo1-014
 *   adv2005.png  → ja-adv2-005
 *
 * Usage:
 *   node scripts/source-artofpkm-images.mjs              # all sets
 *   node scripts/source-artofpkm-images.mjs --set 100    # single artofpkm set ID
 *   node scripts/source-artofpkm-images.mjs --missing    # only cards with no image
 *   node scripts/source-artofpkm-images.mjs --dry-run    # preview, no DB writes
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
const setIdx     = args.indexOf('--set')
const singleSet  = setIdx !== -1 ? parseInt(args[setIdx + 1], 10) : null
const missingOnly = args.includes('--missing')
const dryRun     = args.includes('--dry-run')

const BASE = 'https://www.artofpkm.com'

// Newer ArtOfPKM image filenames no longer encode the TCGDex set id/number.
// These mappings let us fall back to the card detail page collector number.
const ARTOFPKM_SET_TO_RAW_SET = {
  565: 'SV11B', // Black Bolt
  566: 'SV11W', // White Flare
}

// All artofpkm set IDs discovered from the /cards index page
// (sorted ascending so we process oldest sets first)
const ALL_SET_IDS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23,
  25, 27, 28, 30, 31, 34, 35, 39, 40, 42, 43, 45, 46, 48, 50, 51, 52, 53, 54,
  56, 57, 58, 59, 61, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 76, 79, 80, 81,
  82, 84, 85, 87, 88, 89, 91, 93, 94, 95, 97, 99, 100, 102, 103, 104, 105, 106,
  107, 108, 109, 111, 112, 113, 114, 116, 117, 118, 119, 120, 121, 123, 125,
  126, 127, 129, 130, 131, 133, 134, 137, 138, 139, 140, 142, 145, 146, 147,
  150, 151, 152, 154, 156, 157, 158, 159, 164, 165, 166, 168, 171, 172, 173,
  175, 176, 177, 180, 181, 182, 183, 185, 186, 189, 190, 191, 192, 193, 195,
  196, 197, 198, 199, 200, 202, 203, 204, 206, 207, 208, 209, 210, 213, 215,
  216, 217, 219, 220, 222, 223, 226, 227, 228, 231, 232, 234, 236, 237, 238,
  240, 241, 242, 243, 245, 246, 247, 248, 250, 251, 252, 253, 254, 255, 257,
  259, 261, 262, 263, 265, 266, 268, 269, 270, 271, 272, 274, 275, 277, 278,
  279, 285, 286, 287, 288, 290, 291, 294, 296, 297, 299, 300, 301, 303, 304,
  305, 308, 309, 310, 311, 312, 323, 324, 325, 326, 327, 328, 330, 331, 332,
  333, 334, 335, 336, 338, 339, 341, 342, 343, 345, 348, 349, 350, 351, 352,
  354, 355, 356, 357, 359, 360, 361, 362, 364, 366, 368, 369, 370, 372, 373,
  374, 376, 377, 378, 379, 381, 382, 383, 385, 386, 387, 388, 391, 392, 393,
  397, 398, 399, 400, 401, 402, 404, 405, 406, 407, 408, 410, 411, 412, 415,
  417, 419, 420, 421, 422, 423, 424, 427, 429, 430, 431, 432, 433, 434, 435,
  437, 438, 439, 440, 442, 445, 446, 447, 448, 449, 451, 452, 453, 454, 455,
  456, 458, 459, 460, 461, 462, 464, 466, 467, 468, 469, 473, 476, 477, 478,
  479, 481, 482, 483, 484, 485, 486, 488, 490, 491, 493, 494, 495, 499, 500,
  501, 502, 503, 505, 506, 508, 509, 510, 511, 512, 513, 515, 516, 517, 519,
  520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534,
  535, 536, 537, 538, 539, 540, 541, 542, 544, 545, 548, 549, 551, 552, 554,
  556, 557, 558, 559, 563, 565, 566, 570, 571, 573, 574, 575, 577, 578, 579,
  581, 582, 583, 585, 587, 588,
]

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function poolMap(items, limit, fn) {
  let next = 0
  async function worker() { while (next < items.length) { const i = next++; await fn(items[i], i) } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// ── Parse artofpkm filename → { rawSetId, number } ───────────────────────────
// Standard pattern: pcg3002.png → rawSetId=pcg3, number=002
// We match letters+digits(optional) at the start, then a 3-4 digit number.
// Filenames that don't match this pattern are skipped (non-standard names).
function parseFilename(filename) {
  const base = filename.replace(/\.(png|jpg|webp|jpeg)$/i, '')
  // Match: optional-letters, optional-digits, optional-letters, then trailing digits
  const m = base.match(/^([a-z]+(?:\d+[a-z]?)?)(\d{3,4})$/i)
  if (!m) return null
  return { rawSetId: m[1].toLowerCase(), number: m[2] }
}

async function scrapeCardNumber(cardPath) {
  const url = cardPath.startsWith('http') ? cardPath : `${BASE}${cardPath}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokePop-image-bot/1.0)' }
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.match(/<title>\s*(\d{3})\s*\/\s*\d{3}/i)?.[1]
      ?? html.match(/\b(\d{3})\s*\/\s*\d{3}\b/)?.[1]
      ?? null
  } catch {
    return null
  }
}

// ── Scrape a single artofpkm set page ─────────────────────────────────────────
// setIdMap: lowercase rawSetId → actual DB rawSetId (e.g. 'pcg3' → 'PCG3')
async function scrapeSet(setId, setIdMap = {}) {
  const url = `${BASE}/sets/${setId}/cards`
  let html
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokePop-image-bot/1.0)' }
    })
    if (res.status === 404) return []
    if (!res.ok) { process.stdout.write('!'); return [] }
    html = await res.text()
  } catch {
    process.stdout.write('x')
    return []
  }

  const htmlPages = [html]
  const seenBatchOffsets = new Set()
  let nextOffset = html.match(/card_batches\?offset=(\d+)/)?.[1]
  while (nextOffset && !seenBatchOffsets.has(nextOffset)) {
    seenBatchOffsets.add(nextOffset)
    try {
      const batchRes = await fetch(`${BASE}/sets/${setId}/card_batches?offset=${nextOffset}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokePop-image-bot/1.0)' }
      })
      if (!batchRes.ok) break
      const batchHtml = await batchRes.text()
      if (!batchHtml.trim()) break
      htmlPages.push(batchHtml)
      nextOffset = batchHtml.match(/card_batches\?offset=(\d+)/)?.[1]
    } catch {
      break
    }
  }

  const cards = []
  const fallbackRawSetId = ARTOFPKM_SET_TO_RAW_SET[setId] ?? null

  // Newer set pages expose card detail links whose pages contain collector
  // numbers; use those when filenames are generic Pokemon CDN names.
  const anchorRegex = /<a\b[^>]*data-lightbox-url="([^"]+)"[^>]*href="([^"]+)"[\s\S]*?<img\b[^>]*src="([^"]+)"/g
  for (const pageHtml of htmlPages) {
    let match
    while ((match = anchorRegex.exec(pageHtml)) !== null) {
      const [, cardPath, href, src] = match
      const imageUrl = src.startsWith('http') ? src : `${BASE}${src}`
      const largeUrl = href.startsWith('http') ? href : `${BASE}${href}`
      const filename = decodeURIComponent(imageUrl.split('/').pop())
      const parsed = parseFilename(filename)

      if (parsed) continue // handled by the legacy filename parser below
      if (!fallbackRawSetId) continue

      const number = await scrapeCardNumber(cardPath)
      if (!number) continue

      cards.push({
        artofpkmUrl: largeUrl,
        rawSetId: fallbackRawSetId,
        number,
        dbCardId: `ja-${fallbackRawSetId}-${number}`,
      })
    }
  }

  // Find all active storage img src attributes (absolute URLs)
  const imgRegex = /src="(https:\/\/www\.artofpkm\.com\/rails\/active_storage\/representations\/redirect\/[^"]+)"/g

  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const fullUrl = match[1]

    // Filename is the last path segment (URL-decoded)
    const filename = decodeURIComponent(fullUrl.split('/').pop())

    // Skip obvious non-card images
    if (filename === 'image.png' || filename === 'og.jpg') continue

    const parsed = parseFilename(filename)
    if (!parsed) continue

    // Resolve case: 'pcg3' → 'PCG3' (as stored in DB), fallback to uppercase
    const actualSetId = setIdMap[parsed.rawSetId] ?? parsed.rawSetId.toUpperCase()

    cards.push({
      artofpkmUrl: fullUrl,
      rawSetId: actualSetId,
      number: parsed.number,
      dbCardId: `ja-${actualSetId}-${parsed.number}`,
    })
  }

  for (const pageHtml of htmlPages.slice(1)) {
    let batchMatch
    while ((batchMatch = imgRegex.exec(pageHtml)) !== null) {
      const fullUrl = batchMatch[1]
      const filename = decodeURIComponent(fullUrl.split('/').pop())
      if (filename === 'image.png' || filename === 'og.jpg') continue

      const parsed = parseFilename(filename)
      if (!parsed) continue

      const actualSetId = setIdMap[parsed.rawSetId] ?? parsed.rawSetId.toUpperCase()
      cards.push({
        artofpkmUrl: fullUrl,
        rawSetId: actualSetId,
        number: parsed.number,
        dbCardId: `ja-${actualSetId}-${parsed.number}`,
      })
    }
  }

  return cards
}

// ── Bulk UPDATE image URLs ─────────────────────────────────────────────────────
// Uses individual .update() calls (no upsert — avoids NOT NULL constraint on name).
// Runs up to 20 concurrent updates for speed.
async function flushUpdates(rows) {
  let done = 0
  await poolMap(rows, 20, async (u) => {
    const { error } = await supabase
      .from('tcg_cards')
      .update({ image_small: u.image_small, image_large: u.image_large })
      .eq('id', u.id)
    if (error) { process.stdout.write('x') }
    else { totalUpdated++; done++ }
  })
  if (done) process.stdout.write(`+${done} `)
}

// ── Build set ID case map ─────────────────────────────────────────────────────
// artofpkm filenames are all lowercase (pcg3002.png → rawSetId=pcg3)
// but TCGDex set IDs are mixed case (PCG3, neo1, E1, PMCG1, etc.)
// Build: lowercase(rawSetId) → actual DB set_id (without the lang prefix)
async function buildSetIdMap() {
  const { data } = await supabase
    .from('tcg_cards')
    .select('set_id')
    .eq('card_language', 'ja')
  const map = {}
  for (const row of (data ?? [])) {
    // set_id format: 'ja-PCG3' → rawSetId = 'PCG3'
    const parts = row.set_id.split('-')
    const rawSetId = parts.slice(1).join('-')
    map[rawSetId.toLowerCase()] = rawSetId
  }
  return map   // e.g. { 'pcg3': 'PCG3', 'neo1': 'neo1', 'e1': 'E1', ... }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – ArtOfPKM Image Scraper${dryRun ? '  [DRY RUN]' : ''}`)
console.log(`Mode: ${singleSet ? `single set ${singleSet}` : missingOnly ? 'missing images only' : 'all sets'}`)
console.log()

// If missing-only, prefetch which ja card IDs have null images
let missingIds = null
if (missingOnly) {
  console.log('Fetching Japanese cards with missing images from DB…')
  const PAGE = 1000
  const ids = new Set()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('tcg_cards')
      .select('id')
      .eq('card_language', 'ja')
      .is('image_small', null)
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    data.forEach(r => ids.add(r.id))
    if (data.length < PAGE) break
    from += PAGE
  }
  missingIds = ids
  console.log(`→ ${ids.size} cards with no image\n`)
}

console.log('Building set ID case map from DB…')
const setIdMap = await buildSetIdMap()
console.log(`→ ${Object.keys(setIdMap).length} Japanese set IDs loaded\n`)

const setIds = singleSet ? [singleSet] : ALL_SET_IDS
let totalFound    = 0
let totalMatched  = 0
let totalUpdated  = 0
const updates     = []  // { id, image_small, image_large }

for (const setId of setIds) {
  process.stdout.write(`  [${setId}] `)
  const cards = await scrapeSet(setId, setIdMap)

  if (!cards.length) {
    process.stdout.write('0 cards\n')
    await sleep(200)
    continue
  }

  totalFound += cards.length

  // Filter to only cards that exist in our DB (and optionally only missing-image ones)
  const relevant = cards.filter(c => {
    if (missingIds && !missingIds.has(c.dbCardId)) return false
    return true
  })
  const uniqueRelevant = []
  const seenRelevantIds = new Set()
  for (const card of relevant) {
    if (seenRelevantIds.has(card.dbCardId)) continue
    seenRelevantIds.add(card.dbCardId)
    uniqueRelevant.push(card)
  }

  // Verify which of these card IDs actually exist in our DB
  if (uniqueRelevant.length) {
    const ids = uniqueRelevant.map(c => c.dbCardId)

    // Check existence in batches (PostgREST IN filter)
    const { data: existing } = await supabase
      .from('tcg_cards')
      .select('id')
      .in('id', ids)

    const existingSet = new Set((existing ?? []).map(r => r.id))

    for (const card of uniqueRelevant) {
      if (!existingSet.has(card.dbCardId)) continue
      totalMatched++
      updates.push({
        id:          card.dbCardId,
        image_small: card.artofpkmUrl,
        image_large: card.artofpkmUrl,  // same URL — artofpkm serves decent quality
      })
    }
  }

  process.stdout.write(`${cards.length} scraped, ${uniqueRelevant.length} relevant\n`)

  // Flush updates every 500 cards
  if (updates.length >= 500) {
    if (!dryRun) await flushUpdates(updates)
    else totalUpdated += updates.length
    updates.length = 0
  }

  // Polite delay between set requests
  await sleep(300)
}

// Flush remaining updates
if (updates.length) {
  if (!dryRun) await flushUpdates(updates)
  else totalUpdated += updates.length
}

console.log(`\n\n─────────────────────────────────`)
console.log(`Sets processed:   ${setIds.length}`)
console.log(`Cards scraped:    ${totalFound}`)
console.log(`DB matches found: ${totalMatched}`)
console.log(`Images updated:   ${totalUpdated}${dryRun ? '  (dry run)' : ''}`)
console.log(`─────────────────────────────────`)
if (dryRun) console.log('\n(Dry run — no data was written.)')
