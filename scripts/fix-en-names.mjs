#!/usr/bin/env node
/**
 * PokePop – Fix english_name for foreign-language cards
 *
 * Strategy:
 *   1. Build a dexId → English name map from PokeAPI (single paginated fetch)
 *   2. For each ja/zh-cn/zh-tw card with null english_name:
 *      - Fetch the card from TCGDex to get dexId
 *      - Map dexId → EN name (for Pokémon cards)
 *      - For Trainer/Energy: leave null (no reliable EN mapping)
 *   3. Bulk upsert the updated english_name values
 *
 * Usage:
 *   node scripts/fix-en-names.mjs
 *   node scripts/fix-en-names.mjs --lang ja    # single language
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

const args     = process.argv.slice(2)
const langIdx  = args.indexOf('--lang')
const langOnly = langIdx !== -1 ? args[langIdx + 1] : null

const BASE = 'https://api.tcgdex.net/v2'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) { await sleep(300); continue }
      return await res.json()
    } catch { await sleep(300) }
  }
  return null
}

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

// ── Step 1: Build dexId → EN Pokémon name map from PokeAPI ───────────────────
async function buildDexMap() {
  console.log('Fetching Pokémon species list from PokeAPI…')
  const map = {}
  let url = 'https://pokeapi.co/api/v2/pokemon-species?limit=100'

  while (url) {
    const res = await fetch(url)
    if (!res.ok) { console.error('PokeAPI error', res.status); break }
    const { results, next } = await res.json()
    for (const species of results) {
      // URL format: https://pokeapi.co/api/v2/pokemon-species/1/
      const id = parseInt(species.url.split('/').filter(Boolean).pop(), 10)
      // Capitalize first letter of each word (e.g. "mr-mime" → "Mr. Mime")
      const name = species.name
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .replace(/\bMr\b/g, 'Mr.')
        .replace(/\bMrs\b/g, 'Mrs.')
      map[id] = name
    }
    url = next
  }
  console.log(`→ ${Object.keys(map).length} Pokémon species loaded.\n`)
  return map
}

// ── Step 2: Fetch cards with missing english_name from DB ─────────────────────
async function getMissingCards() {
  const targetLangs = langOnly ? [langOnly] : ['ja', 'zh-cn', 'zh-tw']
  const PAGE = 1000
  const all  = []

  for (const l of targetLangs) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, number, set_id, card_language, supertype')
        .eq('card_language', l)
        .is('english_name', null)
        .range(from, from + PAGE - 1)
      if (error) { console.error('DB error:', error.message); break }
      if (!data?.length) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
    console.log(`  ${l}: ${all.filter(c => c.card_language === l).length} cards missing english_name`)
  }
  return all
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\nPokePop – Fix English Names for Foreign Cards\n')

const [dexMap, missingCards] = await Promise.all([
  buildDexMap(),
  getMissingCards(),
])

console.log(`\nTotal: ${missingCards.length} cards to process`)
console.log('Fetching dexId from TCGDex (20 concurrent)…\n')

const updates = []
let done = 0
let filled = 0
let skipped = 0

await poolMap(missingCards, 20, async (card) => {
  // set_id format: "ja-E3" → lang=ja, rawSetId=E3
  const parts    = card.set_id.split('-')
  const rawLang  = parts[0]
  const rawSetId = parts.slice(1).join('-')
  const localId  = card.number

  // For Trainer/Energy, TCGDex often doesn't have dexId — skip API call
  // We still try in case some have useful data
  const tcgCard = await fetchJson(`${BASE}/${rawLang}/cards/${rawSetId}-${localId}`)
  done++

  if (tcgCard?.dexId?.length) {
    // Use first dexId (most cards have one, legendary forms may have multiple)
    const enName = dexMap[tcgCard.dexId[0]]
    if (enName) {
      // Handle special card name suffixes (ex, GX, V, VMAX, etc.)
      // Preserve the suffix from the Japanese card name if detectable
      updates.push({ id: card.id, english_name: enName })
      filled++
    } else {
      skipped++
    }
  } else {
    skipped++
  }

  if (done % 500 === 0 || done === missingCards.length) {
    process.stdout.write(`\r  ${done}/${missingCards.length} checked — ${filled} names found, ${skipped} skipped…`)
  }
})

console.log(`\n\nResults: ${filled} names found out of ${missingCards.length} cards`)
console.log(`  (${skipped} skipped — Trainer/Energy or unknown dex number)\n`)

if (!updates.length) {
  console.log('Nothing to write.')
  process.exit(0)
}

console.log(`Writing ${updates.length} english_name updates to DB…`)

for (let i = 0; i < updates.length; i += 200) {
  const batch = updates.slice(i, i + 200)
  const { error } = await supabase
    .from('tcg_cards')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
  if (error) console.error('\nUpsert error:', error.message)
  else process.stdout.write('.')
}

console.log(`\n\nDone! ${filled} Pokémon cards now have English names.`)
