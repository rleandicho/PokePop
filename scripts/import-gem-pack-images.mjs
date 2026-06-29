/**
 * import-gem-pack-images.mjs
 *
 * Populates images for Chinese Simplified Gem Pack sets using pokipair.com card scans.
 *
 * Supported:
 *   CBB5 — zh-CBB5 (196 cards already in DB, no images → matched by position order)
 *   CBB3 — zh-CBB3 (0 cards in DB → inserts 136 cards with images + sequential numbers)
 *
 * Usage:
 *   node scripts/import-gem-pack-images.mjs         # dry-run (default)
 *   node scripts/import-gem-pack-images.mjs --apply # write to Supabase
 */
import { createClient } from '@supabase/supabase-js'
import { config }       from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const TMP_DIR    = resolve(__dirname, 'tmp')

config()

const DRY_RUN = !process.argv.includes('--apply')
if (DRY_RUN) console.log('[dry-run] Pass --apply to write changes.\n')

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract card number from pokipair URL filename (e.g. "...Store-042-400x548.png" → 42) */
function extractNum(url) {
  const m = url.match(/-(\d+)(?:-\d+x\d+)?\.(?:png|jpg)$/)
  return m ? parseInt(m[1], 10) : null
}

/** Parse all unique pokipair image URLs from saved HTML, sorted by card number */
function parseImages(htmlPath, cardNumPattern) {
  const html = readFileSync(htmlPath, 'utf8')
  const seen = new Set()
  const results = []

  // Extract all quoted URLs matching the pattern
  const re = /"(https:\/\/media\.pokipair\.com[^"]+)"/g
  let m
  while ((m = re.exec(html)) !== null) {
    const url = m[1]
    if (!cardNumPattern.test(url)) continue
    const num = extractNum(url)
    if (num === null || seen.has(num)) continue
    seen.add(num)
    results.push({ num, url })
  }

  results.sort((a, b) => a.num - b.num)
  return results
}

// ── CBB5 — update existing cards with pokipair images ─────────────────────────

async function updateCBB5() {
  console.log('=== CBB5 (zh-CBB5) — updating images ===')

  // Parse CBB5 pokipair images (Ireland pattern, no size suffix)
  const cbb5Images = parseImages(
    resolve(TMP_DIR, 'cbb5.html'),
    /PokiPair-Ireland-\d+\.png$/
  )
  console.log(`Found ${cbb5Images.length} pokipair images for CBB5`)

  // Fetch all DB cards sorted numerically
  const { data: dbCards, error } = await sb
    .from('tcg_cards')
    .select('id, name, number, image_small')
    .eq('set_id', 'zh-CBB5')
    .order('id')

  if (error) throw error

  // Sort by numeric value of card number
  const sorted = [...dbCards].sort((a, b) => parseInt(a.number) - parseInt(b.number))
  console.log(`Found ${sorted.length} DB cards for CBB5`)

  const limit = Math.min(cbb5Images.length, sorted.length)
  const updates = []

  for (let i = 0; i < limit; i++) {
    const card = sorted[i]
    const img  = cbb5Images[i]
    updates.push({ id: card.id, img_num: img.num, url: img.url })
    if (i < 5 || i >= limit - 3) {
      console.log(`  [${i+1}] card ${card.number} ${card.name} → pokipair #${img.num}`)
    } else if (i === 5) {
      console.log('  ...')
    }
  }

  if (!DRY_RUN) {
    let ok = 0
    for (const { id, url } of updates) {
      const { error: e } = await sb
        .from('tcg_cards')
        .update({ image_small: url, image_large: url })
        .eq('id', id)
      if (e) console.error(`  ✗ ${id}:`, e.message)
      else ok++
    }
    console.log(`CBB5: updated ${ok}/${updates.length} cards\n`)
  } else {
    console.log(`[dry-run] Would update ${updates.length} CBB5 cards\n`)
  }
}

// ── CBB3 — insert new cards with pokipair images ───────────────────────────────

async function importCBB3() {
  console.log('=== CBB3 (zh-CBB3) — inserting cards with images ===')

  // Parse CBB3 pokipair images (CBB3 Store pattern, has -400x548 suffix)
  const cbb3Images = parseImages(
    resolve(TMP_DIR, 'cbb3.html'),
    /PokiPair-Store-\d+-400x548\.png$/
  )
  console.log(`Found ${cbb3Images.length} pokipair images for CBB3`)

  // Check what's already in the DB
  const { data: existing } = await sb
    .from('tcg_cards')
    .select('id')
    .eq('set_id', 'zh-CBB3')

  const existingIds = new Set((existing ?? []).map(r => r.id))
  console.log(`Existing CBB3 cards in DB: ${existingIds.size}`)

  const rows = []
  for (const { num, url } of cbb3Images) {
    const numStr = String(num).padStart(3, '0')
    const cardId = `zh-CBB3-${numStr}`
    if (existingIds.has(cardId)) continue

    rows.push({
      id:            cardId,
      set_id:        'zh-CBB3',
      set_name:      '宝石包VOL.3',
      series:        '朱&紫',
      name:          numStr,         // placeholder — no text names available from pokipair
      number:        numStr,
      rarity:        null,           // unknown — pokipair images only
      image_small:   url,
      image_large:   url,
      card_language: 'zh-cn',
      supertype:     'Pokémon',
      is_wotc:       false,
    })
  }

  console.log(`Cards to insert: ${rows.length}`)
  if (rows.length > 0) {
    console.log('  Sample:', rows.slice(0, 3).map(r => r.id).join(', '))
  }

  if (!DRY_RUN && rows.length > 0) {
    // Insert in batches of 50
    let ok = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error: e } = await sb.from('tcg_cards').insert(batch)
      if (e) console.error(`  ✗ batch ${i}:`, e.message)
      else ok += batch.length
    }
    console.log(`CBB3: inserted ${ok}/${rows.length} cards\n`)
  } else if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${rows.length} CBB3 cards\n`)
  }
}

// ── CBB2 — same approach as CBB3 ──────────────────────────────────────────────

async function importCBB2() {
  console.log('=== CBB2 (zh-CBB2) — inserting cards with images ===')

  // Parse CBB2 pokipair images
  const cbb2Images = parseImages(
    resolve(TMP_DIR, 'cbb2.html'),
    /PokiPair-Store-\d+-400x544\.png$/
  )
  console.log(`Found ${cbb2Images.length} pokipair images for CBB2`)

  const { data: existing } = await sb
    .from('tcg_cards')
    .select('id')
    .eq('set_id', 'zh-CBB2')

  const existingIds = new Set((existing ?? []).map(r => r.id))

  const rows = []
  for (const { num, url } of cbb2Images) {
    const numStr = String(num).padStart(3, '0')
    const cardId = `zh-CBB2-${numStr}`
    if (existingIds.has(cardId)) continue

    rows.push({
      id:            cardId,
      set_id:        'zh-CBB2',
      set_name:      '宝石包VOL.2',
      series:        '朱&紫',
      name:          numStr,
      number:        numStr,
      rarity:        null,
      image_small:   url,
      image_large:   url,
      card_language: 'zh-cn',
      supertype:     'Pokémon',
      is_wotc:       false,
    })
  }

  console.log(`Cards to insert: ${rows.length}`)

  if (!DRY_RUN && rows.length > 0) {
    let ok = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error: e } = await sb.from('tcg_cards').insert(batch)
      if (e) console.error(`  ✗ batch ${i}:`, e.message)
      else ok += batch.length
    }
    console.log(`CBB2: inserted ${ok}/${rows.length} cards\n`)
  } else if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${rows.length} CBB2 cards\n`)
  }
}

// ── CBB4 — partial (only cards 100-197 available on pokipair) ─────────────────

async function importCBB4() {
  console.log('=== CBB4 (zh-CBB4) — inserting partial cards with images (100-197) ===')

  const cbb4Images = parseImages(
    resolve(TMP_DIR, 'cbb4.html'),
    /PokiPair-Store-\d+-400x547\.png$/
  )
  console.log(`Found ${cbb4Images.length} pokipair images for CBB4 (partial set)`)

  const { data: existing } = await sb
    .from('tcg_cards')
    .select('id')
    .eq('set_id', 'zh-CBB4')

  const existingIds = new Set((existing ?? []).map(r => r.id))

  const rows = []
  for (const { num, url } of cbb4Images) {
    const numStr = String(num).padStart(3, '0')
    const cardId = `zh-CBB4-${numStr}`
    if (existingIds.has(cardId)) continue

    rows.push({
      id:            cardId,
      set_id:        'zh-CBB4',
      set_name:      '宝石包VOL.4',
      series:        '朱&紫',
      name:          numStr,
      number:        numStr,
      rarity:        null,
      image_small:   url,
      image_large:   url,
      card_language: 'zh-cn',
      supertype:     'Pokémon',
      is_wotc:       false,
    })
  }

  console.log(`Cards to insert: ${rows.length}`)

  if (!DRY_RUN && rows.length > 0) {
    let ok = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error: e } = await sb.from('tcg_cards').insert(batch)
      if (e) console.error(`  ✗ batch ${i}:`, e.message)
      else ok += batch.length
    }
    console.log(`CBB4: inserted ${ok}/${rows.length} cards\n`)
  } else if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${rows.length} CBB4 cards\n`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
  await updateCBB5()
  await importCBB3()
  await importCBB2()
  await importCBB4()
  console.log('Done.')
} catch (err) {
  console.error('Fatal:', err.message)
  process.exit(1)
}
