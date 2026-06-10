#!/usr/bin/env node
/**
 * PokePop – Chinese Gem Pack (宝石包) Importer
 *
 * Imports all 5 Gem Pack volumes (CBB1–CBB5) into tcg_sets and tcg_cards.
 * These are Simplified Chinese (zh-cn) exclusive sets sold only in mainland China.
 *
 * Card numbering follows the unique Gem Pack format:
 *   Pokémon slot N → card numbers N01–N07 (e.g. slot 1 = 101–107, slot 22 = 2201–2207)
 * Each slot has 7 variants (C, C, U, U, R, RR, RRR).
 *
 * NOTE: No CDN (Limitless, TCGDex, Serebii) hosts images for these sets.
 * image_small / image_large are left null. If you obtain card scans, update with:
 *   UPDATE tcg_cards SET image_small = ..., image_large = ... WHERE set_id = 'zh-CBB5' AND number = '2201';
 *
 * Volumes with complete card data: CBB5
 * Volumes with set metadata only (cards TBD): CBB1, CBB2, CBB3, CBB4
 *
 * Dry run (default):
 *   node scripts/import-gem-packs.mjs
 *
 * Apply:
 *   node scripts/import-gem-packs.mjs --apply
 *
 * Import only specific volumes:
 *   node scripts/import-gem-packs.mjs --apply --vol 5
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

const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const apply     = process.argv.includes('--apply')
const volFilter = (() => {
  const idx = process.argv.indexOf('--vol')
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : null
})()

// ── Rarity per slot position (same for all 28 Pokémon in every volume) ────────
const SLOT_RARITIES = ['C', 'C', 'U', 'U', 'R', 'RR', 'RRR']

// ── Helper: build card rows for a volume ─────────────────────────────────────
function buildCards(setId, setName, releaseDate, pokemonList) {
  const rows = []
  pokemonList.forEach(({ slot, en, cn, types }) => {
    SLOT_RARITIES.forEach((rarity, i) => {
      const cardNum = `${slot}${String(i + 1).padStart(2, '0')}`
      rows.push({
        id:            `${setId}-${cardNum}`,
        name:          cn || en,       // Chinese name (or EN if CN not available)
        english_name:  en,
        card_language: 'zh-cn',
        set_id:        setId,
        set_name:      setName,
        series:        '朱&紫',
        release_date:  releaseDate,
        supertype:     'Pokémon',
        hp:            null,           // HP varies by variant; not available from source
        types:         types ?? null,
        evolves_from:  null,
        number:        cardNum,
        rarity:        rarity,
        image_small:   null,           // No CDN hosts Gem Pack images yet
        image_large:   null,
        jp_image_small: null,
        jp_image_large: null,
        is_wotc:       false,
      })
    })
  })
  return rows
}

// ── Set definitions ───────────────────────────────────────────────────────────
const SETS = [
  {
    vol: 1,
    meta: {
      id:            'zh-CBB1',
      name:          '宝石包第一弹',
      series:        '朱&紫',
      printed_total: 196,
      total:         196,
      release_date:  '2025-01-17',
      symbol_url:    null,
      logo_url:      null,
    },
    // Card list for Vol. 1 not yet available — will be populated in a future update
    pokemon: [],
  },
  {
    vol: 2,
    meta: {
      id:            'zh-CBB2',
      name:          '宝石包VOL.2',
      series:        '朱&紫',
      printed_total: 196,
      total:         196,
      release_date:  '2025-04-01',
      symbol_url:    null,
      logo_url:      null,
    },
    pokemon: [],
  },
  {
    vol: 3,
    meta: {
      id:            'zh-CBB3',
      name:          '宝石包VOL.3',
      series:        '朱&紫',
      printed_total: 196,
      total:         196,
      release_date:  '2025-09-01',
      symbol_url:    null,
      logo_url:      null,
    },
    pokemon: [],
  },
  {
    vol: 4,
    meta: {
      id:            'zh-CBB4',
      name:          '宝石包VOL.4',
      series:        '朱&紫',
      printed_total: 196,
      total:         196,
      release_date:  '2026-01-01',
      symbol_url:    null,
      logo_url:      null,
    },
    pokemon: [],
  },
  {
    vol: 5,
    meta: {
      id:            'zh-CBB5',
      name:          '宝石包 第5弾',
      series:        '朱&紫',
      printed_total: 196,
      total:         196,
      release_date:  '2026-04-24',
      symbol_url:    null,
      logo_url:      null,
    },
    // Full card list confirmed via Bulbapedia
    // slot = Pokémon index (used as card number prefix: slot 1 → 101–107, slot 22 → 2201–2207)
    pokemon: [
      { slot:  1, en: 'Captain Pikachu',    cn: '旅长皮卡丘',     types: ['Lightning'] },
      { slot:  2, en: 'Hisuian Growlithe',  cn: '洗翠卡蒂狗',     types: ['Fire']      },
      { slot:  3, en: 'Magneton',           cn: '三合磁怪',       types: ['Lightning'] },
      { slot:  4, en: 'Chansey',            cn: '吉利蛋',         types: ['Colorless'] },
      { slot:  5, en: 'Horsea',             cn: '墨海马',         types: ['Water']     },
      { slot:  6, en: 'Sunflora',           cn: '向日花怪',       types: ['Grass']     },
      { slot:  7, en: 'Skarmory',           cn: '盔甲鸟',         types: ['Metal']     },
      { slot:  8, en: 'Houndoom',           cn: '黑暗火焰犬',     types: ['Darkness']  },
      { slot:  9, en: 'Phanpy',             cn: '小象怪',         types: ['Fighting']  },
      { slot: 10, en: 'Vibrava',            cn: '超声波幼虫',     types: ['Dragon']    },
      { slot: 11, en: 'Chimecho',           cn: '风铃铃',         types: ['Psychic']   },
      { slot: 12, en: 'Spheal',             cn: '海豹球',         types: ['Water']     },
      { slot: 13, en: 'Latios',             cn: '拉帝欧斯',       types: ['Dragon']    },
      { slot: 14, en: 'Timburr',            cn: '肌肉宝宝',       types: ['Fighting']  },
      { slot: 15, en: 'Joltik',             cn: '虫电宝',         types: ['Lightning'] },
      { slot: 16, en: 'Stunfisk',           cn: '比目鱼',         types: ['Lightning'] },
      { slot: 17, en: 'Braviary',           cn: '勇战鸟',         types: ['Colorless'] },
      { slot: 18, en: 'Vivillon',           cn: '彩粉蝶',         types: ['Grass']     },
      { slot: 19, en: 'Raboot',             cn: '腾蹴小将',       types: ['Fire']      },
      { slot: 20, en: 'Applin',             cn: '苹裹龙',         types: ['Dragon']    },
      { slot: 21, en: 'Milcery',            cn: '奶羹仙子',       types: ['Psychic']   },
      { slot: 22, en: 'Floragato',          cn: '花草喵喵',       types: ['Grass']     },
      { slot: 23, en: 'Crocalor',           cn: '火鳄默默',       types: ['Fire']      },
      { slot: 24, en: 'Quaxwell',           cn: '鸭呱呱',         types: ['Water']     },
      { slot: 25, en: 'Ceruledge',          cn: '刃影铠甲',       types: ['Fire']      },
      { slot: 26, en: 'Wattrel',            cn: '电风鹱',         types: ['Lightning'] },
      { slot: 27, en: 'Cetitan',            cn: '棱柱暴雪象',     types: ['Water']     },
      { slot: 28, en: 'Tatsugiri',          cn: '龙鱼君',         types: ['Water']     },
    ],
  },
]

// ── Filter by --vol if requested ──────────────────────────────────────────────
const targetSets = volFilter ? SETS.filter(s => s.vol === volFilter) : SETS

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – Chinese Gem Pack (宝石包) Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
if (volFilter) console.log(`Filtering to Vol. ${volFilter} only`)
console.log()

for (const { vol, meta, pokemon } of targetSets) {
  const cards = buildCards(meta.id, meta.name, meta.release_date, pokemon)
  console.log(`Vol. ${vol}: ${meta.id} "${meta.name}"  ${cards.length || '(no cards yet)'} cards`)

  if (!apply) {
    if (cards.length > 0) {
      for (const c of cards.slice(0, 7)) {
        console.log(`  ${c.id}  ${c.rarity.padEnd(4)}  ${c.english_name}`)
      }
      if (cards.length > 7) console.log(`  ... and ${cards.length - 7} more`)
    }
    continue
  }

  // Upsert set
  const { error: setErr } = await supabase
    .from('tcg_sets')
    .upsert(meta, { onConflict: 'id', ignoreDuplicates: false })
  if (setErr) {
    console.error(`  ✗ Set upsert failed: ${setErr.message}`)
    continue
  }
  console.log(`  ✓ Set ${meta.id} upserted`)

  if (cards.length === 0) {
    console.log('  (no cards to import for this volume)')
    continue
  }

  // Upsert cards in batches of 50
  const BATCH = 50
  let written = 0
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH)
    const { error: cardErr } = await supabase
      .from('tcg_cards')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
    if (cardErr) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH) + 1} failed: ${cardErr.message}`)
      break
    }
    written += batch.length
  }
  if (written > 0) console.log(`  ✓ ${written} cards upserted`)
}

if (!apply) {
  console.log('\nRun with --apply to write to Supabase.')
  console.log('NOTE: Card images are not available from any CDN — image fields will be null.')
}
