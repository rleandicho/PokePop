#!/usr/bin/env node
/**
 * PokePop – Abyss Eye (アビスアイ) Importer
 *
 * Imports the Japanese set M5 "Abyss Eye" into tcg_sets and tcg_cards.
 * All cards include english_name so they surface in English-language searches.
 *
 * The set is not yet in TCGDex (released May 22 2026), so card data is sourced
 * from Bulbapedia / Serebii / snkrdunk. Images are left null for now and can be
 * backfilled once TCGDex or artofpkm.com indexes the set.
 *
 * Dry run (default):
 *   node scripts/import-abyss-eye.mjs
 *
 * Apply:
 *   node scripts/import-abyss-eye.mjs --apply
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

// ── Set metadata ──────────────────────────────────────────────────────────────
const SET = {
  id:            'ja-M5',
  name:          'アビスアイ',
  series:        'ポケモンカードゲーム MEGA',
  printed_total: 81,
  total:         118,
  release_date:  '2026-05-22',
  symbol_url:    null,
  logo_url:      null,
}

// ── Card list ─────────────────────────────────────────────────────────────────
// Sources: Bulbapedia, Serebii.net, snkrdunk.com, pokeca.net
// english_name = pre-release EN translations from Bulbapedia
// Japanese names = カタカナ from Japanese card databases
const CARDS_RAW = [
  // ── Grass ──
  { n: '001', ja: 'トロピウス',       en: 'Tropius',            s: 'Pokémon',  hp: '110', types: ['Grass'],    rarity: 'C',   evo: null            },
  { n: '002', ja: 'アゴジムシ',       en: 'Grubbin',            s: 'Pokémon',  hp: '70',  types: ['Grass'],    rarity: 'C',   evo: null            },
  { n: '003', ja: 'カリキリ',         en: 'Fomantis',           s: 'Pokémon',  hp: '70',  types: ['Grass'],    rarity: 'C',   evo: null            },
  { n: '004', ja: 'ラランテスex',     en: 'Lurantis ex',        s: 'Pokémon',  hp: '260', types: ['Grass'],    rarity: 'RR',  evo: 'Fomantis'      },
  { n: '005', ja: 'チャデス',         en: 'Poltchageist',       s: 'Pokémon',  hp: '30',  types: ['Grass'],    rarity: 'C',   evo: null            },
  { n: '006', ja: 'ヤバソチャ',       en: 'Sinistcha',          s: 'Pokémon',  hp: '60',  types: ['Grass'],    rarity: 'U',   evo: 'Poltchageist'  },
  // ── Fire ──
  { n: '007', ja: 'ヒードラン',       en: 'Heatran',            s: 'Pokémon',  hp: '140', types: ['Fire'],     rarity: 'U',   evo: null            },
  { n: '008', ja: 'ヤクデ',           en: 'Sizzlipede',         s: 'Pokémon',  hp: '80',  types: ['Fire'],     rarity: 'C',   evo: null            },
  { n: '009', ja: 'マルヤクデ',       en: 'Centiskorch',        s: 'Pokémon',  hp: '140', types: ['Fire'],     rarity: 'C',   evo: 'Sizzlipede'    },
  { n: '010', ja: 'カルボウ',         en: 'Charcadet',          s: 'Pokémon',  hp: '80',  types: ['Fire'],     rarity: 'C',   evo: null            },
  { n: '011', ja: 'グレンアルマ',     en: 'Armarouge',          s: 'Pokémon',  hp: '140', types: ['Fire'],     rarity: 'R',   evo: 'Charcadet'     },
  // ── Water ──
  { n: '012', ja: 'トサキント',       en: 'Goldeen',            s: 'Pokémon',  hp: '70',  types: ['Water'],    rarity: 'C',   evo: null            },
  { n: '013', ja: 'アズマオウ',       en: 'Seaking',            s: 'Pokémon',  hp: '110', types: ['Water'],    rarity: 'U',   evo: 'Goldeen'       },
  { n: '014', ja: 'ホエルコ',         en: 'Wailmer',            s: 'Pokémon',  hp: '130', types: ['Water'],    rarity: 'C',   evo: null            },
  { n: '015', ja: 'ホエルオーex',     en: 'Wailord ex',         s: 'Pokémon',  hp: '380', types: ['Water'],    rarity: 'RR',  evo: 'Wailmer'       },
  { n: '016', ja: 'ジーランス',       en: 'Relicanth',          s: 'Pokémon',  hp: '100', types: ['Water'],    rarity: 'U',   evo: null            },
  { n: '017', ja: 'アシマリ',         en: 'Popplio',            s: 'Pokémon',  hp: '70',  types: ['Water'],    rarity: 'C',   evo: null            },
  { n: '018', ja: 'オシャマリ',       en: 'Brionne',            s: 'Pokémon',  hp: '90',  types: ['Water'],    rarity: 'C',   evo: 'Popplio'       },
  { n: '019', ja: 'アシレーヌ',       en: 'Primarina',          s: 'Pokémon',  hp: '150', types: ['Water'],    rarity: 'R',   evo: 'Brionne'       },
  { n: '020', ja: 'ナミイルカ',       en: 'Finizen',            s: 'Pokémon',  hp: '80',  types: ['Water'],    rarity: 'C',   evo: null            },
  { n: '021', ja: 'イルカマン',       en: 'Palafin',            s: 'Pokémon',  hp: '150', types: ['Water'],    rarity: 'U',   evo: 'Finizen'       },
  // ── Lightning ──
  { n: '022', ja: 'ラクライ',         en: 'Electrike',          s: 'Pokémon',  hp: '70',  types: ['Lightning'], rarity: 'C',  evo: null            },
  { n: '023', ja: 'ライボルト',       en: 'Manectric',          s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'U',  evo: 'Electrike'     },
  { n: '024', ja: 'デンヂムシ',       en: 'Charjabug',          s: 'Pokémon',  hp: '100', types: ['Lightning'], rarity: 'C',  evo: 'Grubbin'       },
  { n: '025', ja: 'クワガノン',       en: 'Vikavolt',           s: 'Pokémon',  hp: '160', types: ['Lightning'], rarity: 'U',  evo: 'Charjabug'     },
  { n: '026', ja: 'メガゼラオラex',   en: 'Mega Zeraora ex',    s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'RR', evo: null            },
  { n: '027', ja: 'ミライドン',       en: 'Miraidon',           s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'U',  evo: null            },
  // ── Psychic ──
  { n: '028', ja: 'ヤドン',           en: 'Slowpoke',           s: 'Pokémon',  hp: '70',  types: ['Psychic'],  rarity: 'C',   evo: null            },
  { n: '029', ja: 'ヤドラン',         en: 'Slowbro',            s: 'Pokémon',  hp: '130', types: ['Psychic'],  rarity: 'U',   evo: 'Slowpoke'      },
  { n: '030', ja: 'ルージュラ',       en: 'Jynx',               s: 'Pokémon',  hp: '100', types: ['Psychic'],  rarity: 'C',   evo: null            },
  { n: '031', ja: 'カゲボウズ',       en: 'Shuppet',            s: 'Pokémon',  hp: '50',  types: ['Psychic'],  rarity: 'C',   evo: null            },
  { n: '032', ja: 'ジュペッタ',       en: 'Banette',            s: 'Pokémon',  hp: '80',  types: ['Psychic'],  rarity: 'U',   evo: 'Shuppet'       },
  { n: '033', ja: 'ミカルゲ',         en: 'Spiritomb',          s: 'Pokémon',  hp: '60',  types: ['Psychic'],  rarity: 'R',   evo: null            },
  { n: '034', ja: 'ヒトモシ',         en: 'Litwick',            s: 'Pokémon',  hp: '70',  types: ['Psychic'],  rarity: 'C',   evo: null            },
  { n: '035', ja: 'ランプラー',       en: 'Lampent',            s: 'Pokémon',  hp: '90',  types: ['Psychic'],  rarity: 'C',   evo: 'Litwick'       },
  { n: '036', ja: 'メガシャンデラex', en: 'Mega Chandelure ex', s: 'Pokémon',  hp: '350', types: ['Psychic'],  rarity: 'RR',  evo: 'Lampent'       },
  { n: '037', ja: 'ダダリン',         en: 'Dhelmise',           s: 'Pokémon',  hp: '60',  types: ['Psychic'],  rarity: 'U',   evo: null            },
  { n: '038', ja: 'マーシャドー',     en: 'Marshadow',          s: 'Pokémon',  hp: '90',  types: ['Psychic'],  rarity: 'U',   evo: null            },
  { n: '039', ja: 'コノヨザル',       en: 'Annihilape',         s: 'Pokémon',  hp: '150', types: ['Psychic'],  rarity: 'U',   evo: 'Primeape'      },
  // ── Fighting ──
  { n: '040', ja: 'マンキー',         en: 'Mankey',             s: 'Pokémon',  hp: '50',  types: ['Fighting'], rarity: 'C',   evo: null            },
  { n: '041', ja: 'オコリザル',       en: 'Primeape',           s: 'Pokémon',  hp: '110', types: ['Fighting'], rarity: 'C',   evo: 'Mankey'        },
  { n: '042', ja: 'ズガイドス',       en: 'Cranidos',           s: 'Pokémon',  hp: '100', types: ['Fighting'], rarity: 'C',   evo: null            },
  { n: '043', ja: 'ラムパルドex',     en: 'Rampardos ex',       s: 'Pokémon',  hp: '330', types: ['Fighting'], rarity: 'RR',  evo: 'Cranidos'      },
  { n: '044', ja: 'モグリュー',       en: 'Drilbur',            s: 'Pokémon',  hp: '70',  types: ['Fighting'], rarity: 'C',   evo: null            },
  { n: '045', ja: 'コライドン',       en: 'Koraidon',           s: 'Pokémon',  hp: '130', types: ['Fighting'], rarity: 'U',   evo: null            },
  // ── Darkness ──
  { n: '046', ja: 'メガダークライex', en: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'], rarity: 'RR',  evo: null            },
  { n: '047', ja: 'バルチャイ',       en: 'Vullaby',            s: 'Pokémon',  hp: '70',  types: ['Darkness'], rarity: 'C',   evo: null            },
  { n: '048', ja: 'バルジーナ',       en: 'Mandibuzz',          s: 'Pokémon',  hp: '120', types: ['Darkness'], rarity: 'C',   evo: 'Vullaby'       },
  { n: '049', ja: 'マーイーカ',       en: 'Inkay',              s: 'Pokémon',  hp: '60',  types: ['Darkness'], rarity: 'C',   evo: null            },
  { n: '050', ja: 'カラマネロ',       en: 'Malamar',            s: 'Pokémon',  hp: '120', types: ['Darkness'], rarity: 'U',   evo: 'Inkay'         },
  { n: '051', ja: 'クスネ',           en: 'Nickit',             s: 'Pokémon',  hp: '70',  types: ['Darkness'], rarity: 'C',   evo: null            },
  { n: '052', ja: 'フォクスライ',     en: 'Thievul',            s: 'Pokémon',  hp: '100', types: ['Darkness'], rarity: 'U',   evo: 'Nickit'        },
  { n: '053', ja: 'モルペコex',       en: 'Morpeko ex',         s: 'Pokémon',  hp: '180', types: ['Darkness'], rarity: 'RR',  evo: null            },
  { n: '054', ja: 'ザルード',         en: 'Zarude',             s: 'Pokémon',  hp: '130', types: ['Darkness'], rarity: 'U',   evo: null            },
  { n: '055', ja: 'オラチフ',         en: 'Maschiff',           s: 'Pokémon',  hp: '70',  types: ['Darkness'], rarity: 'C',   evo: null            },
  { n: '056', ja: 'マフィティフ',     en: 'Mabosstiff',         s: 'Pokémon',  hp: '140', types: ['Darkness'], rarity: 'C',   evo: 'Maschiff'      },
  { n: '057', ja: 'イーユイ',         en: 'Chi-Yu',             s: 'Pokémon',  hp: '90',  types: ['Darkness'], rarity: 'R',   evo: null            },
  // ── Metal ──
  { n: '058', ja: 'エアームド',       en: 'Skarmory',           s: 'Pokémon',  hp: '120', types: ['Metal'],    rarity: 'C',   evo: null            },
  { n: '059', ja: 'タテトプス',       en: 'Shieldon',           s: 'Pokémon',  hp: '100', types: ['Metal'],    rarity: 'C',   evo: null            },
  { n: '060', ja: 'トリデプス',       en: 'Bastiodon',          s: 'Pokémon',  hp: '160', types: ['Metal'],    rarity: 'R',   evo: 'Shieldon'      },
  { n: '061', ja: 'ドーミラー',       en: 'Bronzor',            s: 'Pokémon',  hp: '80',  types: ['Metal'],    rarity: 'C',   evo: null            },
  { n: '062', ja: 'ドータクン',       en: 'Bronzong',           s: 'Pokémon',  hp: '130', types: ['Metal'],    rarity: 'U',   evo: 'Bronzor'       },
  { n: '063', ja: 'メガドリュウズex', en: 'Mega Excadrill ex',  s: 'Pokémon',  hp: '340', types: ['Metal'],    rarity: 'RR',  evo: 'Drilbur'       },
  // ── Colorless ──
  { n: '064', ja: 'ツツケラ',         en: 'Pikipek',            s: 'Pokémon',  hp: '70',  types: ['Colorless'], rarity: 'C',  evo: null            },
  { n: '065', ja: 'ケラッパ',         en: 'Trumbeak',           s: 'Pokémon',  hp: '90',  types: ['Colorless'], rarity: 'C',  evo: 'Pikipek'       },
  { n: '066', ja: 'ドデカバシ',       en: 'Toucannon',          s: 'Pokémon',  hp: '150', types: ['Colorless'], rarity: 'U',  evo: 'Trumbeak'      },
  { n: '067', ja: 'タイプ：ヌル',     en: 'Type: Null',         s: 'Pokémon',  hp: '110', types: ['Colorless'], rarity: 'C',  evo: null            },
  { n: '068', ja: 'シルヴァディ',     en: 'Silvally',           s: 'Pokémon',  hp: '140', types: ['Colorless'], rarity: 'R',  evo: 'Type: Null'    },
  { n: '069', ja: 'オトシドリ',       en: 'Bombirdier',         s: 'Pokémon',  hp: '100', types: ['Colorless'], rarity: 'C',  evo: null            },
  // ── Trainers ──
  { n: '070', ja: 'ダークベル',              en: 'Dark Bell',             s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '071', ja: '古びたずがいの化石',      en: 'Antique Skull Fossil',  s: 'Trainer', hp: null, types: [], rarity: 'C', evo: null },
  { n: '072', ja: '古びたたての化石',        en: 'Antique Armor Fossil',  s: 'Trainer', hp: null, types: [], rarity: 'C', evo: null },
  { n: '073', ja: 'ごうかいボム',            en: 'Terrific Bomb',         s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '074', ja: 'リトライバッジ',          en: 'Retry Badge',           s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '075', ja: 'カスミの元気',            en: "Misty's Spirit",        s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '076', ja: 'グラジオの決戦',          en: "Gladion's Showdown",    s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '077', ja: 'サビ組のしたっぱ',        en: 'Rust Syndicate Grunt',  s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '078', ja: 'ムク',                    en: 'Gwynn',                 s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '079', ja: '化石採掘場',              en: 'Fossil Excavation Site', s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  // ── Special Energy ──
  { n: '080', ja: 'ボルト雷エネルギー',      en: 'Volt L Energy',         s: 'Energy',  hp: null, types: ['Lightning'], rarity: 'R', evo: null },
  { n: '081', ja: 'シャドー悪エネルギー',    en: 'Shadowy D Energy',      s: 'Energy',  hp: null, types: ['Darkness'],  rarity: 'R', evo: null },
  // ── Secret Rares – AR (Art Rare) ──
  { n: '082', ja: 'カリキリ',         en: 'Fomantis',           s: 'Pokémon',  hp: '70',  types: ['Grass'],    rarity: 'AR',  evo: null            },
  { n: '083', ja: 'グレンアルマ',     en: 'Armarouge',          s: 'Pokémon',  hp: '140', types: ['Fire'],     rarity: 'AR',  evo: 'Charcadet'     },
  { n: '084', ja: 'トサキント',       en: 'Goldeen',            s: 'Pokémon',  hp: '70',  types: ['Water'],    rarity: 'AR',  evo: null            },
  { n: '085', ja: 'アシレーヌ',       en: 'Primarina',          s: 'Pokémon',  hp: '150', types: ['Water'],    rarity: 'AR',  evo: 'Brionne'       },
  { n: '086', ja: 'ライボルト',       en: 'Manectric',          s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'AR', evo: 'Electrike'     },
  { n: '087', ja: 'ヤドラン',         en: 'Slowbro',            s: 'Pokémon',  hp: '130', types: ['Psychic'],  rarity: 'AR',  evo: 'Slowpoke'      },
  { n: '088', ja: 'ダダリン',         en: 'Dhelmise',           s: 'Pokémon',  hp: '60',  types: ['Psychic'],  rarity: 'AR',  evo: null            },
  { n: '089', ja: 'フォクスライ',     en: 'Thievul',            s: 'Pokémon',  hp: '100', types: ['Darkness'], rarity: 'AR',  evo: 'Nickit'        },
  { n: '090', ja: 'ザルード',         en: 'Zarude',             s: 'Pokémon',  hp: '130', types: ['Darkness'], rarity: 'AR',  evo: null            },
  { n: '091', ja: 'トリデプス',       en: 'Bastiodon',          s: 'Pokémon',  hp: '160', types: ['Metal'],    rarity: 'AR',  evo: 'Shieldon'      },
  { n: '092', ja: 'ドデカバシ',       en: 'Toucannon',          s: 'Pokémon',  hp: '150', types: ['Colorless'], rarity: 'AR', evo: 'Trumbeak'      },
  { n: '093', ja: 'シルヴァディ',     en: 'Silvally',           s: 'Pokémon',  hp: '140', types: ['Colorless'], rarity: 'AR', evo: 'Type: Null'    },
  // ── Secret Rares – SR (Super Rare) ──
  { n: '094', ja: 'ラランテスex',     en: 'Lurantis ex',        s: 'Pokémon',  hp: '260', types: ['Grass'],    rarity: 'SR',  evo: 'Fomantis'      },
  { n: '095', ja: 'ホエルオーex',     en: 'Wailord ex',         s: 'Pokémon',  hp: '380', types: ['Water'],    rarity: 'SR',  evo: 'Wailmer'       },
  { n: '096', ja: 'メガゼラオラex',   en: 'Mega Zeraora ex',    s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'SR', evo: null            },
  { n: '097', ja: 'メガシャンデラex', en: 'Mega Chandelure ex', s: 'Pokémon',  hp: '350', types: ['Psychic'],  rarity: 'SR',  evo: 'Lampent'       },
  { n: '098', ja: 'ラムパルドex',     en: 'Rampardos ex',       s: 'Pokémon',  hp: '330', types: ['Fighting'], rarity: 'SR',  evo: 'Cranidos'      },
  { n: '099', ja: 'メガダークライex', en: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'], rarity: 'SR',  evo: null            },
  { n: '100', ja: 'モルペコex',       en: 'Morpeko ex',         s: 'Pokémon',  hp: '180', types: ['Darkness'], rarity: 'SR',  evo: null            },
  { n: '101', ja: 'メガドリュウズex', en: 'Mega Excadrill ex',  s: 'Pokémon',  hp: '340', types: ['Metal'],    rarity: 'SR',  evo: 'Drilbur'       },
  { n: '102', ja: 'アイアンディフェンダー', en: 'Iron Defender',      s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '103', ja: 'エネルギーつけかえ',    en: 'Energy Switch',      s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '104', ja: 'はたきおとす',          en: 'Crushing Hammer',    s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '105', ja: 'ダークベル',            en: 'Dark Bell',          s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '106', ja: 'ごうかいボム',          en: 'Terrific Bomb',      s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '107', ja: 'ゆうかんのバンド',      en: 'Brave Bangle',       s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '108', ja: 'カスミの元気',          en: "Misty's Spirit",     s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '109', ja: 'グラジオの決戦',        en: "Gladion's Showdown", s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '110', ja: 'サビ組のしたっぱ',      en: 'Rust Syndicate Grunt', s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  { n: '111', ja: 'ムク',                  en: 'Gwynn',              s: 'Trainer', hp: null, types: [], rarity: 'SR', evo: null },
  // ── Secret Rares – SAR (Special Art Rare) ──
  { n: '112', ja: 'メガゼラオラex',   en: 'Mega Zeraora ex',    s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'SAR', evo: null       },
  { n: '113', ja: 'メガシャンデラex', en: 'Mega Chandelure ex', s: 'Pokémon',  hp: '350', types: ['Psychic'],  rarity: 'SAR', evo: 'Lampent'  },
  { n: '114', ja: 'メガダークライex', en: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'], rarity: 'SAR', evo: null       },
  { n: '115', ja: 'モルペコex',       en: 'Morpeko ex',         s: 'Pokémon',  hp: '180', types: ['Darkness'], rarity: 'SAR', evo: null       },
  { n: '116', ja: 'グラジオの決戦',   en: "Gladion's Showdown", s: 'Trainer',  hp: null,  types: [], rarity: 'SAR', evo: null                 },
  { n: '117', ja: 'ムク',             en: 'Gwynn',              s: 'Trainer',  hp: null,  types: [], rarity: 'SAR', evo: null                 },
  // ── Secret Rare – UR (Ultra Rare / Illustration) ──
  { n: '118', ja: 'メガダークライex', en: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'], rarity: 'UR',  evo: null       },
]

// ── Build card rows ───────────────────────────────────────────────────────────
const CARD_ROWS = CARDS_RAW.map(c => ({
  id:           `ja-M5-${c.n}`,
  name:         c.ja,
  english_name: c.en,
  card_language: 'ja',
  set_id:        'ja-M5',
  set_name:      'アビスアイ',
  series:        'ポケモンカードゲーム MEGA',
  release_date:  '2026-05-22',
  supertype:     c.s,
  hp:            c.hp,
  types:         c.types.length ? c.types : null,
  evolves_from:  c.evo,
  number:        c.n,
  rarity:        c.rarity,
  image_small:   null,   // backfill later via TCGDex / artofpkm once indexed
  image_large:   null,
  jp_image_small: null,
  jp_image_large: null,
  is_wotc:       false,
}))

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – Abyss Eye (アビスアイ) Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
console.log(`Set: ja-M5 | ${SET.total} cards | Release: ${SET.release_date}\n`)

if (!apply) {
  console.log('── SET ROW ─────────────────────────────────────────')
  console.log(JSON.stringify(SET, null, 2))
  console.log(`\n── CARD ROWS (${CARD_ROWS.length}) ─────────────────────────────`)
  for (const c of CARD_ROWS) {
    console.log(`  ${c.id}  ${c.rarity.padEnd(4)}  ${c.english_name}  /  ${c.name}`)
  }
  console.log('\nRun with --apply to write to Supabase.')
  process.exit(0)
}

// 1. Upsert set
console.log('Upserting set row...')
const { error: setErr } = await supabase
  .from('tcg_sets')
  .upsert(SET, { onConflict: 'id', ignoreDuplicates: false })
if (setErr) {
  console.error('  Set upsert failed:', setErr.message)
  process.exit(1)
}
console.log(`  ✓ Set ja-M5 upserted`)

// 2. Upsert cards in batches of 50
console.log(`\nUpserting ${CARD_ROWS.length} cards...`)
const BATCH = 50
let written = 0
for (let i = 0; i < CARD_ROWS.length; i += BATCH) {
  const batch = CARD_ROWS.slice(i, i + BATCH)
  const { error: cardErr } = await supabase
    .from('tcg_cards')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
  if (cardErr) {
    console.error(`  Batch ${Math.floor(i/BATCH)+1} failed:`, cardErr.message)
    process.exit(1)
  }
  written += batch.length
  process.stdout.write(`  ${written}/${CARD_ROWS.length} written...\r`)
}

console.log(`\n  ✓ All ${written} cards upserted`)
console.log('\nDone. Images are null — backfill once TCGDex / artofpkm indexes the set.')
console.log('Tip: run `npm run seed-tcgdex-prices -- --lang ja --set M5` once TCGDex has this set.')
