#!/usr/bin/env node
/**
 * PokePop – First Partner Illustration Collection Series 2 (MEP Promos) Importer
 *
 * Imports 9 promo cards (MEP 046–054) into tcg_cards.
 * These cards are part of the existing MEP Black Star Promos set (already in DB).
 * Artist: Saboteri. Rarity: Illustration Rare.
 * Release: June 19 2026 (EN). Each card is a Holographic Full Art panoramic starter.
 *
 * Three regional trios (each trio shares a connected panoramic illustration):
 *   Johto  — Chikorita 046, Cyndaquil 047, Totodile 048
 *   Unova  — Snivy 049, Tepig 050, Oshawott 051
 *   Galar  — Grookey 052, Scorbunny 053, Sobble 054
 *
 * Images sourced from Bulbagarden archives (full-resolution).
 *
 * Dry run (default):
 *   node scripts/import-mep-series2.mjs
 *
 * Apply:
 *   node scripts/import-mep-series2.mjs --apply
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const apply    = process.argv.includes('--apply')

// ── Bulbagarden full-res image base ───────────────────────────────────────────
// Thumb URLs: .../thumb/X/XX/FileName.jpg/180px-FileName.jpg
// Full-res:   .../X/XX/FileName.jpg
const BG = 'https://archives.bulbagarden.net/media/upload'

const CARDS = [
  // ── Johto ─────────────────────────────────────────────────────────────────
  {
    id:           'mep-46',
    name:         'Chikorita',
    number:       '46',
    hp:           70,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/4/41/ChikoritaMEPPromo46.jpg`,
    image_large:  `${BG}/4/41/ChikoritaMEPPromo46.jpg`,
  },
  {
    id:           'mep-47',
    name:         'Cyndaquil',
    number:       '47',
    hp:           70,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/f/fb/CyndaquilMEPPromo47.jpg`,
    image_large:  `${BG}/f/fb/CyndaquilMEPPromo47.jpg`,
  },
  {
    id:           'mep-48',
    name:         'Totodile',
    number:       '48',
    hp:           80,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/8/8c/TotodileMEPPromo48.jpg`,
    image_large:  `${BG}/8/8c/TotodileMEPPromo48.jpg`,
  },
  // ── Unova ─────────────────────────────────────────────────────────────────
  {
    id:           'mep-49',
    name:         'Snivy',
    number:       '49',
    hp:           60,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/2/2f/SnivyMEPPromo49.jpg`,
    image_large:  `${BG}/2/2f/SnivyMEPPromo49.jpg`,
  },
  {
    id:           'mep-50',
    name:         'Tepig',
    number:       '50',
    hp:           80,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/c/c2/TepigMEPPromo50.jpg`,
    image_large:  `${BG}/c/c2/TepigMEPPromo50.jpg`,
  },
  {
    id:           'mep-51',
    name:         'Oshawott',
    number:       '51',
    hp:           70,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/0/02/OshawottMEPPromo51.jpg`,
    image_large:  `${BG}/0/02/OshawottMEPPromo51.jpg`,
  },
  // ── Galar ─────────────────────────────────────────────────────────────────
  {
    id:           'mep-52',
    name:         'Grookey',
    number:       '52',
    hp:           70,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/4/48/GrookeyMEPPromo52.jpg`,
    image_large:  `${BG}/4/48/GrookeyMEPPromo52.jpg`,
  },
  {
    id:           'mep-53',
    name:         'Scorbunny',
    number:       '53',
    hp:           70,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/e/e5/ScorbunnyMEPPromo53.jpg`,
    image_large:  `${BG}/e/e5/ScorbunnyMEPPromo53.jpg`,
  },
  {
    id:           'mep-54',
    name:         'Sobble',
    number:       '54',
    hp:           70,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  `${BG}/3/37/SobbleMEPPromo54.jpg`,
    image_large:  `${BG}/3/37/SobbleMEPPromo54.jpg`,
  },
]

// ── Shared fields for all 9 cards ─────────────────────────────────────────────
const SHARED = {
  set_id:        'mep',
  set_name:      'MEP Black Star Promos',
  series:        'Scarlet & Violet',
  release_date:  '2026-06-19',
  supertype:     'Pokémon',
  card_language: 'en',
  english_name:  null,   // same as name for EN cards
  artist:        'Saboteri',
  evolves_from:  null,
  subtypes:      ['Basic'],
  is_wotc:       false,
  jp_image_small: null,
  jp_image_large: null,
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – MEP Series 2 Promo Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
console.log()

const rows = CARDS.map(c => ({ ...SHARED, ...c, english_name: c.name }))

for (const r of rows) {
  console.log(`  ${r.id.padEnd(10)} ${r.number.padEnd(8)} ${r.rarity.padEnd(20)} ${r.name}`)
}

if (!apply) {
  console.log('\nRun with --apply to write to Supabase.')
  process.exit(0)
}

// Verify the MEP set exists
const { data: mepSet, error: setErr } = await supabase
  .from('tcg_sets')
  .select('id, name')
  .eq('id', 'mep')
  .maybeSingle()

if (setErr || !mepSet) {
  console.error('\nERROR: MEP set not found in tcg_sets. Make sure the MEP set exists before running this script.')
  console.error('You can add it manually or check the set ID used in your DB.')
  process.exit(1)
}
console.log(`\n✓ MEP set found: "${mepSet.name}"`)

// Upsert all 9 cards
const { error: cardErr } = await supabase
  .from('tcg_cards')
  .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

if (cardErr) {
  console.error(`\n✗ Card upsert failed: ${cardErr.message}`)
  process.exit(1)
}

console.log(`✓ ${rows.length} cards upserted into tcg_cards`)
console.log('\nDone! No pricing data available yet — TCGPlayer typically lists these within a week of release.')
console.log('Re-run the price refresh once cards are listed: npm run refresh-prices')
