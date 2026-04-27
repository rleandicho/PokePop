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

  // Find all active storage img src attributes (absolute URLs)
  const imgRegex = /src="(https:\/\/www\.artofpkm\.com\/rails\/active_storage\/representations\/redirect\/[^"]+)"/g
  const cards = []
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

  return cards
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

  // Verify which of these card IDs actually exist in our DB
  if (relevant.length) {
    const ids = relevant.map(c => c.dbCardId)

    // Check existence in batches (PostgREST IN filter)
    const { data: existing } = await supabase
      .from('tcg_cards')
      .select('id')
      .in('id', ids)

    const existingSet = new Set((existing ?? []).map(r => r.id))

    for (const card of relevant) {
      if (!existingSet.has(card.dbCardId)) continue
      totalMatched++
      updates.push({
        id:          card.dbCardId,
        image_small: card.artofpkmUrl,
        image_large: card.artofpkmUrl,  // same URL — artofpkm serves decent quality
      })
    }
  }

  process.stdout.write(`${cards.length} scraped, ${relevant.length} relevant\n`)

  // Flush updates every 500 cards
  if (updates.length >= 500) {
    if (!dryRun) {
      for (let i = 0; i < updates.length; i += 200) {
        const batch = updates.slice(i, i + 200)
        const { error } = await supabase
          .from('tcg_cards')
          .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
        if (error) console.error('\nUpsert error:', error.message)
        else { process.stdout.write('+'); totalUpdated += batch.length }
      }
    } else {
      totalUpdated += updates.length
    }
    updates.length = 0
  }

  // Polite delay between set requests
  await sleep(300)
}

// Flush remaining updates
if (updates.length && !dryRun) {
  for (let i = 0; i < updates.length; i += 200) {
    const batch = updates.slice(i, i + 200)
    const { error } = await supabase
      .from('tcg_cards')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
    if (error) console.error('\nUpsert error:', error.message)
    else { process.stdout.write('+'); totalUpdated += batch.length }
  }
} else if (updates.length && dryRun) {
  totalUpdated += updates.length
}

console.log(`\n\n─────────────────────────────────`)
console.log(`Sets processed:   ${setIds.length}`)
console.log(`Cards scraped:    ${totalFound}`)
console.log(`DB matches found: ${totalMatched}`)
console.log(`Images updated:   ${totalUpdated}${dryRun ? '  (dry run)' : ''}`)
console.log(`─────────────────────────────────`)
if (dryRun) console.log('\n(Dry run — no data was written.)')
