#!/usr/bin/env node
/**
 * PokePop – First Partner Illustration Collection Series 3 (MEP Promos) Importer
 *
 * Imports 9 promo cards (MEP 055–063) into tcg_cards.
 * These cards are part of the existing MEP Black Star Promos set (already in DB).
 * Rarity: Illustration Rare (full art panoramic starter illustrations).
 * Release: August 7 2026 (EN). Artist: Saboteri (same as Series 1 & 2).
 *
 * Three regional trios (each trio shares a connected panoramic illustration):
 *   Hoenn  — Treecko 055, Torchic 056, Mudkip 057
 *   Kalos  — Chespin 058, Fennekin 059, Froakie 060
 *   Paldea — Sprigatito 061, Fuecoco 062, Quaxly 063
 *
 * Images: Limitless TCG CDN (MEP set, EN, card numbers 055–063).
 *
 * Dry run (default):
 *   node scripts/import-mep-series3.mjs
 *
 * Apply:
 *   node scripts/import-mep-series3.mjs --apply
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

// Limitless CDN image URL
const lim = n => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP/MEP_${String(n).padStart(3, '0')}_R_EN_LG.png`

const CARDS = [
  // ── Hoenn ─────────────────────────────────────────────────────────────────
  {
    id:           'mep-55',
    name:         'Treecko',
    number:       '55',
    hp:           60,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  lim(55),
    image_large:  lim(55),
  },
  {
    id:           'mep-56',
    name:         'Torchic',
    number:       '56',
    hp:           60,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  lim(56),
    image_large:  lim(56),
  },
  {
    id:           'mep-57',
    name:         'Mudkip',
    number:       '57',
    hp:           70,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  lim(57),
    image_large:  lim(57),
  },
  // ── Kalos ─────────────────────────────────────────────────────────────────
  {
    id:           'mep-58',
    name:         'Chespin',
    number:       '58',
    hp:           70,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  lim(58),
    image_large:  lim(58),
  },
  {
    id:           'mep-59',
    name:         'Fennekin',
    number:       '59',
    hp:           60,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  lim(59),
    image_large:  lim(59),
  },
  {
    id:           'mep-60',
    name:         'Froakie',
    number:       '60',
    hp:           60,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  lim(60),
    image_large:  lim(60),
  },
  // ── Paldea ────────────────────────────────────────────────────────────────
  {
    id:           'mep-61',
    name:         'Sprigatito',
    number:       '61',
    hp:           70,
    types:        ['Grass'],
    rarity:       'Illustration Rare',
    image_small:  lim(61),
    image_large:  lim(61),
  },
  {
    id:           'mep-62',
    name:         'Fuecoco',
    number:       '62',
    hp:           70,
    types:        ['Fire'],
    rarity:       'Illustration Rare',
    image_small:  lim(62),
    image_large:  lim(62),
  },
  {
    id:           'mep-63',
    name:         'Quaxly',
    number:       '63',
    hp:           70,
    types:        ['Water'],
    rarity:       'Illustration Rare',
    image_small:  lim(63),
    image_large:  lim(63),
  },
]

// ── Shared fields for all 9 cards ─────────────────────────────────────────────
const SHARED = {
  set_id:        'mep',
  set_name:      'MEP Black Star Promos',
  series:        'Scarlet & Violet',
  release_date:  '2026-08-07',
  supertype:     'Pokémon',
  card_language: 'en',
  english_name:  null,   // filled per card below
  artist:        'Saboteri',
  evolves_from:  null,
  subtypes:      ['Basic'],
  is_wotc:       false,
  jp_image_small: null,
  jp_image_large: null,
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – MEP Series 3 Promo Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
console.log('First Partner Illustration Collection Series 3 (Hoenn / Kalos / Paldea)')
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
  console.error('\nERROR: MEP set not found in tcg_sets. Ensure the MEP set exists before running this script.')
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
console.log('\nDone! MEP 055–063 are now in the library.')
console.log('Note: hp values are estimated from Series 2 patterns; update once confirmed from card scans.')
console.log('Re-run price refresh once cards are listed: npm run refresh-prices')
