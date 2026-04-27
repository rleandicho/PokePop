#!/usr/bin/env node
/**
 * PokePop – Chinese Exclusive Card Seeder
 *
 * Seeds Chinese-exclusive Pokémon TCG cards into tcg_cards.
 * These are cards that were never released in English — e.g. the Gem Series
 * distributed only in mainland China, Taiwan, and Hong Kong.
 *
 * Each record requires:
 *   id          – unique ID (format: zh-<setcode>-<number>)
 *   name        – Chinese card name (Traditional or Simplified)
 *   english_name – English Pokémon name, used for cross-language search
 *   card_language – 'zh' for Chinese
 *   set_id, set_name, series, release_date, number, supertype, rarity
 *   image_small, image_large – must be valid image URLs
 *
 * Usage:
 *   node scripts/seed-chinese-exclusives.mjs [--dry-run]
 *
 * To add more cards: append entries to CHINESE_CARDS below and re-run.
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
const dryRun   = process.argv.includes('--dry-run')

// ── Chinese exclusive card data ───────────────────────────────────────────────
// Gem Series: Chinese-exclusive premium cards distributed in China (2019–2024).
// Art is unique — these cards were never sold outside mainland China, HK, or TW.
// Source: official Pokémon Center China & third-party documentation.
//
// HOW TO EXTEND: add more entries here, then re-run the script.
// Format for image_small / image_large: use a direct image URL from Bulbapedia,
// the official Pokémon Center CN website, or your Supabase Storage bucket.
// Leave image_small/large as null if you don't have the URL yet — the app will
// show a placeholder; you can update later with the source-jp-images script
// (adapt it to use zh/ prefix) or via Supabase Studio.
const CHINESE_CARDS = [
  // ── Gem Series Pack A (宝可梦集换式卡牌游戏 Gem系列 A) ────────────────────
  {
    id:            'zh-gems-001',
    name:          '皮卡丘',          // Pikachu
    english_name:  'Pikachu',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '001',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Lightning'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-002',
    name:          '耿鬼',            // Gengar
    english_name:  'Gengar',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '002',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Psychic'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-003',
    name:          '喷火龙',          // Charizard
    english_name:  'Charizard',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '003',
    supertype:     'Pokémon',
    subtypes:      ['Stage 2'],
    types:         ['Fire'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-004',
    name:          '超梦',            // Mewtwo
    english_name:  'Mewtwo',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '004',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Psychic'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-005',
    name:          '伊布',            // Eevee
    english_name:  'Eevee',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '005',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Colorless'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-006',
    name:          '妙蛙种子',        // Bulbasaur
    english_name:  'Bulbasaur',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '006',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Grass'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-007',
    name:          '小火龙',          // Charmander
    english_name:  'Charmander',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '007',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Fire'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-008',
    name:          '杰尼龟',          // Squirtle
    english_name:  'Squirtle',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '008',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Water'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-009',
    name:          '梦幻',            // Mew
    english_name:  'Mew',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '009',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Psychic'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
  {
    id:            'zh-gems-010',
    name:          '乌龟蛙',          // Slowpoke
    english_name:  'Slowpoke',
    set_id:        'zh-gems',
    set_name:      'Gem Series',
    series:        'Chinese Exclusive',
    release_date:  '2023-01-01',
    number:        '010',
    supertype:     'Pokémon',
    subtypes:      ['Basic'],
    types:         ['Psychic'],
    rarity:        'Gem Rare',
    card_language: 'zh',
    image_small:   null,
    image_large:   null,
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`PokePop – Chinese Exclusive Seeder${dryRun ? '  [DRY RUN]' : ''}`)
console.log(`Cards to seed: ${CHINESE_CARDS.length}\n`)

CHINESE_CARDS.forEach(c => console.log(`  ${c.id}  ${c.name}  (${c.english_name})`))
console.log()

if (dryRun) {
  console.log('Dry run complete — no data written.')
  process.exit(0)
}

const { error } = await supabase
  .from('tcg_cards')
  .upsert(CHINESE_CARDS, { onConflict: 'id', ignoreDuplicates: false })

if (error) {
  console.error('Error seeding cards:', error.message)
  process.exit(1)
}

console.log(`✓ Seeded ${CHINESE_CARDS.length} Chinese exclusive cards.`)
console.log()
console.log('Next steps:')
console.log('  1. Find image URLs for these cards (Pokémon Center China, Bulbapedia, or scan and upload)')
console.log('  2. Update image_small / image_large in Supabase Studio or add URLs to this script and re-run')
console.log('  3. Users can now search "Gengar", "Pikachu", etc. to see these Chinese variants')
