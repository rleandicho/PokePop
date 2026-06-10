#!/usr/bin/env node
/**
 * PokePop – Ninja Spinner (ニンジャスピナー) Importer
 *
 * Imports the Japanese MEGA set M4 "Ninja Spinner" into tcg_sets and tcg_cards.
 * 120 cards total (83 regular + 37 secret rares).
 * Images sourced from Limitless TCG CDN (confirmed working).
 *
 * Dry run (default):
 *   node scripts/import-ninja-spinner.mjs
 *
 * Apply:
 *   node scripts/import-ninja-spinner.mjs --apply
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

// Image URL: Limitless CDN (non-zero-padded card number, confirmed working)
const img = n => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/M4/M4_${parseInt(n, 10)}_R_JP_LG.png`

// ── Set metadata ──────────────────────────────────────────────────────────────
const SET = {
  id:            'ja-M4',
  name:          'ニンジャスピナー',
  series:        'ポケモンカードゲーム MEGA',
  printed_total: 83,
  total:         120,
  release_date:  '2026-03-13',
  symbol_url:    null,
  logo_url:      null,
}

// ── Card list ─────────────────────────────────────────────────────────────────
// Sources: Limitless TCG, Bulbapedia, Serebii
// s = supertype, evo = evolves_from
const CARDS_RAW = [
  // ── Grass ──
  { n: '001', ja: 'ビードル',           en: 'Weedle',              s: 'Pokémon', hp: '50',  types: ['Grass'],     rarity: 'C',  evo: null            },
  { n: '002', ja: 'コクーン',           en: 'Kakuna',              s: 'Pokémon', hp: '80',  types: ['Grass'],     rarity: 'C',  evo: 'Weedle'        },
  { n: '003', ja: 'スピアーex',         en: 'Beedrill ex',         s: 'Pokémon', hp: '310', types: ['Grass'],     rarity: 'RR', evo: 'Kakuna'        },
  { n: '004', ja: 'モンジャラ',         en: 'Carnivine',           s: 'Pokémon', hp: '90',  types: ['Grass'],     rarity: 'C',  evo: null            },
  { n: '005', ja: 'ハリマロン',         en: 'Chespin',             s: 'Pokémon', hp: '70',  types: ['Grass'],     rarity: 'C',  evo: null            },
  { n: '006', ja: 'ハリボーグ',         en: 'Quilladin',           s: 'Pokémon', hp: '100', types: ['Grass'],     rarity: 'C',  evo: 'Chespin'       },
  { n: '007', ja: 'ブリガロン',         en: 'Chesnaught',          s: 'Pokémon', hp: '180', types: ['Grass'],     rarity: 'R',  evo: 'Quilladin'     },
  // ── Fire ──
  { n: '008', ja: 'ロコン',             en: 'Vulpix',              s: 'Pokémon', hp: '70',  types: ['Fire'],      rarity: 'C',  evo: null            },
  { n: '009', ja: 'キュウコン',         en: 'Ninetales',           s: 'Pokémon', hp: '120', types: ['Fire'],      rarity: 'U',  evo: 'Vulpix'        },
  { n: '010', ja: 'ホウオウ',           en: 'Ho-Oh',               s: 'Pokémon', hp: '130', types: ['Fire'],      rarity: 'U',  evo: null            },
  { n: '011', ja: 'フォッコ',           en: 'Fennekin',            s: 'Pokémon', hp: '70',  types: ['Fire'],      rarity: 'C',  evo: null            },
  { n: '012', ja: 'テールナー',         en: 'Braixen',             s: 'Pokémon', hp: '100', types: ['Fire'],      rarity: 'C',  evo: 'Fennekin'      },
  { n: '013', ja: 'マフォクシー',       en: 'Delphox',             s: 'Pokémon', hp: '160', types: ['Fire'],      rarity: 'R',  evo: 'Braixen'       },
  { n: '014', ja: 'シシコ',             en: 'Litleo',              s: 'Pokémon', hp: '70',  types: ['Fire'],      rarity: 'C',  evo: null            },
  { n: '015', ja: 'メガカエンジシex',   en: 'Mega Pyroar ex',      s: 'Pokémon', hp: '340', types: ['Fire'],      rarity: 'RR', evo: 'Litleo'        },
  // ── Water ──
  { n: '016', ja: 'テッポウオ',         en: 'Remoraid',            s: 'Pokémon', hp: '70',  types: ['Water'],     rarity: 'C',  evo: null            },
  { n: '017', ja: 'オクタン',           en: 'Octillery',           s: 'Pokémon', hp: '110', types: ['Water'],     rarity: 'C',  evo: 'Remoraid'      },
  { n: '018', ja: 'デリバード',         en: 'Delibird',            s: 'Pokémon', hp: '90',  types: ['Water'],     rarity: 'U',  evo: null            },
  { n: '019', ja: 'ケルデオ',           en: 'Keldeo',              s: 'Pokémon', hp: '110', types: ['Water'],     rarity: 'U',  evo: null            },
  { n: '020', ja: 'ケロマツ',           en: 'Froakie',             s: 'Pokémon', hp: '70',  types: ['Water'],     rarity: 'C',  evo: null            },
  { n: '021', ja: 'ゲコガシラ',         en: 'Frogadier',           s: 'Pokémon', hp: '100', types: ['Water'],     rarity: 'C',  evo: 'Froakie'       },
  { n: '022', ja: 'メガゲッコウガex',   en: 'Mega Greninja ex',    s: 'Pokémon', hp: '350', types: ['Water'],     rarity: 'RR', evo: 'Frogadier'     },
  { n: '023', ja: 'カチコール',         en: 'Bergmite',            s: 'Pokémon', hp: '80',  types: ['Water'],     rarity: 'C',  evo: null            },
  { n: '024', ja: 'クレベース',         en: 'Avalugg',             s: 'Pokémon', hp: '160', types: ['Water'],     rarity: 'U',  evo: 'Bergmite'      },
  { n: '025', ja: 'コソクムシ',         en: 'Wimpod',              s: 'Pokémon', hp: '70',  types: ['Water'],     rarity: 'C',  evo: null            },
  { n: '026', ja: 'グソクムシャ',       en: 'Golisopod',           s: 'Pokémon', hp: '140', types: ['Water'],     rarity: 'U',  evo: 'Wimpod'        },
  // ── Lightning ──
  { n: '027', ja: 'メリープ',           en: 'Mareep',              s: 'Pokémon', hp: '70',  types: ['Lightning'], rarity: 'C',  evo: null            },
  { n: '028', ja: 'モコモコ',           en: 'Flaaffy',             s: 'Pokémon', hp: '90',  types: ['Lightning'], rarity: 'C',  evo: 'Mareep'        },
  { n: '029', ja: 'デンリュウ',         en: 'Ampharos',            s: 'Pokémon', hp: '160', types: ['Lightning'], rarity: 'R',  evo: 'Flaaffy'       },
  { n: '030', ja: 'エモンガ',           en: 'Emolga',              s: 'Pokémon', hp: '70',  types: ['Lightning'], rarity: 'C',  evo: null            },
  // ── Psychic ──
  { n: '031', ja: 'デオキシス（ノーマルフォルム）', en: 'Deoxys (Normal)',  s: 'Pokémon', hp: '110', types: ['Psychic'], rarity: 'U', evo: null },
  { n: '032', ja: 'デオキシス（アタックフォルム）', en: 'Deoxys (Attack)',  s: 'Pokémon', hp: '120', types: ['Psychic'], rarity: 'U', evo: null },
  { n: '033', ja: 'デオキシス（ディフェンスフォルム）', en: 'Deoxys (Defense)', s: 'Pokémon', hp: '130', types: ['Psychic'], rarity: 'U', evo: null },
  { n: '034', ja: 'デオキシス（スピードフォルム）', en: 'Deoxys (Speed)',   s: 'Pokémon', hp: '100', types: ['Psychic'], rarity: 'U', evo: null },
  { n: '035', ja: 'メガフラエッテex',   en: 'Mega Floette ex',     s: 'Pokémon', hp: '250', types: ['Psychic'],   rarity: 'RR', evo: null            },
  { n: '036', ja: 'ニャスパー',         en: 'Espurr',              s: 'Pokémon', hp: '60',  types: ['Psychic'],   rarity: 'C',  evo: null            },
  { n: '037', ja: 'ニャオニクス',       en: 'Meowstic',            s: 'Pokémon', hp: '100', types: ['Psychic'],   rarity: 'U',  evo: 'Espurr'        },
  { n: '038', ja: 'ボクレー',           en: 'Phantump',            s: 'Pokémon', hp: '70',  types: ['Psychic'],   rarity: 'C',  evo: null            },
  { n: '039', ja: 'オーロット',         en: 'Trevenant',           s: 'Pokémon', hp: '130', types: ['Psychic'],   rarity: 'R',  evo: 'Phantump'      },
  { n: '040', ja: 'バケッチャ',         en: 'Pumpkaboo',           s: 'Pokémon', hp: '60',  types: ['Psychic'],   rarity: 'C',  evo: null            },
  { n: '041', ja: 'パンプジンex',       en: 'Gourgeist ex',        s: 'Pokémon', hp: '270', types: ['Psychic'],   rarity: 'RR', evo: 'Pumpkaboo'     },
  { n: '042', ja: 'ゼルネアス',         en: 'Xerneas',             s: 'Pokémon', hp: '130', types: ['Psychic'],   rarity: 'R',  evo: null            },
  // ── Fighting ──
  { n: '043', ja: 'ウソッキー',         en: 'Sudowoodo',           s: 'Pokémon', hp: '110', types: ['Fighting'],  rarity: 'U',  evo: null            },
  { n: '044', ja: 'ゴマゾウ',           en: 'Phanpy',              s: 'Pokémon', hp: '80',  types: ['Fighting'],  rarity: 'C',  evo: null            },
  { n: '045', ja: 'ドンファン',         en: 'Donphan',             s: 'Pokémon', hp: '150', types: ['Fighting'],  rarity: 'C',  evo: 'Phanpy'        },
  { n: '046', ja: 'ヤジロン',           en: 'Baltoy',              s: 'Pokémon', hp: '70',  types: ['Fighting'],  rarity: 'C',  evo: null            },
  { n: '047', ja: 'ネンドール',         en: 'Claydol',             s: 'Pokémon', hp: '120', types: ['Fighting'],  rarity: 'U',  evo: 'Baltoy'        },
  // ── Darkness ──
  { n: '048', ja: 'ズバット',           en: 'Zubat',               s: 'Pokémon', hp: '40',  types: ['Darkness'],  rarity: 'C',  evo: null            },
  { n: '049', ja: 'ゴルバット',         en: 'Golbat',              s: 'Pokémon', hp: '80',  types: ['Darkness'],  rarity: 'C',  evo: 'Zubat'         },
  { n: '050', ja: 'クロバット',         en: 'Crobat',              s: 'Pokémon', hp: '130', types: ['Darkness'],  rarity: 'U',  evo: 'Golbat'        },
  { n: '051', ja: 'ハリーセン',         en: 'Qwilfish',            s: 'Pokémon', hp: '90',  types: ['Darkness'],  rarity: 'C',  evo: null            },
  { n: '052', ja: 'スカンプー',         en: 'Stunky',              s: 'Pokémon', hp: '70',  types: ['Darkness'],  rarity: 'C',  evo: null            },
  { n: '053', ja: 'スカタンク',         en: 'Skuntank',            s: 'Pokémon', hp: '110', types: ['Darkness'],  rarity: 'U',  evo: 'Stunky'        },
  { n: '054', ja: 'ヤブクロン',         en: 'Trubbish',            s: 'Pokémon', hp: '70',  types: ['Darkness'],  rarity: 'C',  evo: null            },
  { n: '055', ja: 'ダストダス',         en: 'Garbodor',            s: 'Pokémon', hp: '140', types: ['Darkness'],  rarity: 'U',  evo: 'Trubbish'      },
  { n: '056', ja: 'クズモー',           en: 'Skrelp',              s: 'Pokémon', hp: '70',  types: ['Darkness'],  rarity: 'C',  evo: null            },
  // ── Metal ──
  { n: '057', ja: 'ダンバル',           en: 'Beldum',              s: 'Pokémon', hp: '70',  types: ['Metal'],     rarity: 'C',  evo: null            },
  { n: '058', ja: 'メタング',           en: 'Metang',              s: 'Pokémon', hp: '100', types: ['Metal'],     rarity: 'C',  evo: 'Beldum'        },
  { n: '059', ja: 'メタグロス',         en: 'Metagross',           s: 'Pokémon', hp: '180', types: ['Metal'],     rarity: 'U',  evo: 'Metang'        },
  { n: '060', ja: 'テッシード',         en: 'Ferroseed',           s: 'Pokémon', hp: '70',  types: ['Metal'],     rarity: 'C',  evo: null            },
  { n: '061', ja: 'ナットレイ',         en: 'Ferrothorn',          s: 'Pokémon', hp: '130', types: ['Metal'],     rarity: 'U',  evo: 'Ferroseed'     },
  { n: '062', ja: 'コバルオンex',       en: 'Cobalion ex',         s: 'Pokémon', hp: '210', types: ['Metal'],     rarity: 'RR', evo: null            },
  // ── Dragon ──
  { n: '063', ja: 'メガドラミドロex',   en: 'Mega Dragalge ex',    s: 'Pokémon', hp: '330', types: ['Dragon'],    rarity: 'RR', evo: 'Skrelp'        },
  { n: '064', ja: 'ヌメラ',             en: 'Goomy',               s: 'Pokémon', hp: '60',  types: ['Dragon'],    rarity: 'C',  evo: null            },
  { n: '065', ja: 'ヌメイル',           en: 'Sliggoo',             s: 'Pokémon', hp: '90',  types: ['Dragon'],    rarity: 'C',  evo: 'Goomy'         },
  { n: '066', ja: 'ヌメルゴン',         en: 'Goodra',              s: 'Pokémon', hp: '160', types: ['Dragon'],    rarity: 'U',  evo: 'Sliggoo'       },
  // ── Colorless ──
  { n: '067', ja: 'ケンタロス',         en: 'Tauros',              s: 'Pokémon', hp: '130', types: ['Colorless'], rarity: 'R',  evo: null            },
  { n: '068', ja: 'ミネズミ',           en: 'Patrat',              s: 'Pokémon', hp: '70',  types: ['Colorless'], rarity: 'C',  evo: null            },
  { n: '069', ja: 'ミルホッグ',         en: 'Watchog',             s: 'Pokémon', hp: '100', types: ['Colorless'], rarity: 'C',  evo: 'Patrat'        },
  { n: '070', ja: 'チラーミィ',         en: 'Minccino',            s: 'Pokémon', hp: '70',  types: ['Colorless'], rarity: 'C',  evo: null            },
  { n: '071', ja: 'チラチーノex',       en: 'Cinccino ex',         s: 'Pokémon', hp: '240', types: ['Colorless'], rarity: 'RR', evo: 'Minccino'      },
  // ── Trainers ──
  { n: '072', ja: 'スペシャルレッドカード', en: 'Special Red Card',   s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '073', ja: 'おおきなつりあみ',      en: 'Big Catching Net',   s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '074', ja: 'へんしんのしょ',        en: 'Transformation Tome',s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '075', ja: 'AZのやすらぎ',          en: "AZ's Tranquility",   s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '076', ja: 'フィリップ',            en: 'Philippe',           s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '077', ja: 'ホミカのパフォーマンス',en: "Roxie's Performance", s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '078', ja: 'エマ',                  en: 'Emma',               s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '079', ja: "アンジョのフラエッテ",  en: "Ange's Floette",     s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  { n: '080', ja: 'プリズムタワー',        en: 'Prism Tower',        s: 'Trainer', hp: null, types: [], rarity: 'U', evo: null },
  // ── Special Energy ──
  { n: '081', ja: 'ニトロRエネルギー',     en: 'Nitro R Energy',     s: 'Energy',  hp: null, types: ['Fire'],   rarity: 'R', evo: null },
  { n: '082', ja: 'バブルWエネルギー',     en: 'Bubbly W Energy',    s: 'Energy',  hp: null, types: ['Water'],  rarity: 'R', evo: null },
  { n: '083', ja: 'マグネットMエネルギー', en: 'Magnetic M Energy',  s: 'Energy',  hp: null, types: ['Metal'],  rarity: 'R', evo: null },
  // ── Secret Rares – Art Rare (AR) ──
  { n: '084', ja: 'ハリマロン',           en: 'Chespin',             s: 'Pokémon', hp: '70',  types: ['Grass'],     rarity: 'AR', evo: null        },
  { n: '085', ja: 'フォッコ',             en: 'Fennekin',            s: 'Pokémon', hp: '70',  types: ['Fire'],      rarity: 'AR', evo: null        },
  { n: '086', ja: 'ケロマツ',             en: 'Froakie',             s: 'Pokémon', hp: '70',  types: ['Water'],     rarity: 'AR', evo: null        },
  { n: '087', ja: 'ゲコガシラ',           en: 'Frogadier',           s: 'Pokémon', hp: '100', types: ['Water'],     rarity: 'AR', evo: 'Froakie'   },
  { n: '088', ja: 'デンリュウ',           en: 'Ampharos',            s: 'Pokémon', hp: '160', types: ['Lightning'], rarity: 'AR', evo: 'Flaaffy'   },
  { n: '089', ja: 'ゼルネアス',           en: 'Xerneas',             s: 'Pokémon', hp: '130', types: ['Psychic'],   rarity: 'AR', evo: null        },
  { n: '090', ja: 'ネンドール',           en: 'Claydol',             s: 'Pokémon', hp: '120', types: ['Fighting'],  rarity: 'AR', evo: 'Baltoy'    },
  { n: '091', ja: 'クロバット',           en: 'Crobat',              s: 'Pokémon', hp: '130', types: ['Darkness'],  rarity: 'AR', evo: 'Golbat'    },
  { n: '092', ja: 'メタング',             en: 'Metang',              s: 'Pokémon', hp: '100', types: ['Metal'],     rarity: 'AR', evo: 'Beldum'    },
  { n: '093', ja: 'ヌメイル',             en: 'Sliggoo',             s: 'Pokémon', hp: '90',  types: ['Dragon'],    rarity: 'AR', evo: 'Goomy'     },
  { n: '094', ja: 'ケンタロス',           en: 'Tauros',              s: 'Pokémon', hp: '130', types: ['Colorless'], rarity: 'AR', evo: null        },
  { n: '095', ja: 'ミルホッグ',           en: 'Watchog',             s: 'Pokémon', hp: '100', types: ['Colorless'], rarity: 'AR', evo: 'Patrat'    },
  // ── Secret Rares – SR ──
  { n: '096', ja: 'スピアーex',           en: 'Beedrill ex',         s: 'Pokémon', hp: '310', types: ['Grass'],     rarity: 'SR', evo: 'Kakuna'    },
  { n: '097', ja: 'メガカエンジシex',     en: 'Mega Pyroar ex',      s: 'Pokémon', hp: '340', types: ['Fire'],      rarity: 'SR', evo: 'Litleo'    },
  { n: '098', ja: 'メガゲッコウガex',     en: 'Mega Greninja ex',    s: 'Pokémon', hp: '350', types: ['Water'],     rarity: 'SR', evo: 'Frogadier' },
  { n: '099', ja: 'メガフラエッテex',     en: 'Mega Floette ex',     s: 'Pokémon', hp: '250', types: ['Psychic'],   rarity: 'SR', evo: null        },
  { n: '100', ja: 'パンプジンex',         en: 'Gourgeist ex',        s: 'Pokémon', hp: '270', types: ['Psychic'],   rarity: 'SR', evo: 'Pumpkaboo' },
  { n: '101', ja: 'コバルオンex',         en: 'Cobalion ex',         s: 'Pokémon', hp: '210', types: ['Metal'],     rarity: 'SR', evo: null        },
  { n: '102', ja: 'メガドラミドロex',     en: 'Mega Dragalge ex',    s: 'Pokémon', hp: '330', types: ['Dragon'],    rarity: 'SR', evo: 'Skrelp'    },
  { n: '103', ja: 'チラチーノex',         en: 'Cinccino ex',         s: 'Pokémon', hp: '240', types: ['Colorless'], rarity: 'SR', evo: 'Minccino'  },
  { n: '104', ja: 'エネルギーつけかえ',   en: 'Energy Retrieval',    s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '105', ja: 'ビッグアイスクリーム', en: 'Jumbo Ice Cream',     s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '106', ja: 'スペシャルレッドカード',en: 'Special Red Card',   s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '107', ja: 'ツールスクラッパー',   en: 'Tool Scrapper',       s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '108', ja: 'AZのやすらぎ',         en: "AZ's Tranquility",    s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '109', ja: 'フィリップ',           en: 'Philippe',            s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '110', ja: 'ホミカのパフォーマンス',en: "Roxie's Performance", s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '111', ja: 'エマ',                 en: 'Emma',                s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '112', ja: 'サーフィンビーチ',     en: 'Surfing Beach',       s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  { n: '113', ja: 'プリズムタワー',       en: 'Prism Tower',         s: 'Trainer', hp: null,  types: [],            rarity: 'SR', evo: null        },
  // ── Secret Rares – SAR (Special Art Rare) ──
  { n: '114', ja: 'メガゲッコウガex',     en: 'Mega Greninja ex',    s: 'Pokémon', hp: '350', types: ['Water'],     rarity: 'SAR', evo: 'Frogadier' },
  { n: '115', ja: 'メガフラエッテex',     en: 'Mega Floette ex',     s: 'Pokémon', hp: '250', types: ['Psychic'],   rarity: 'SAR', evo: null        },
  { n: '116', ja: 'メガドラミドロex',     en: 'Mega Dragalge ex',    s: 'Pokémon', hp: '330', types: ['Dragon'],    rarity: 'SAR', evo: 'Skrelp'    },
  { n: '117', ja: 'チラチーノex',         en: 'Cinccino ex',         s: 'Pokémon', hp: '240', types: ['Colorless'], rarity: 'SAR', evo: 'Minccino'  },
  { n: '118', ja: 'AZのやすらぎ',         en: "AZ's Tranquility",    s: 'Trainer', hp: null,  types: [],            rarity: 'SAR', evo: null        },
  { n: '119', ja: 'ホミカのパフォーマンス',en: "Roxie's Performance", s: 'Trainer', hp: null,  types: [],            rarity: 'SAR', evo: null        },
  // ── Ultra Rare (UR) ──
  { n: '120', ja: 'メガゲッコウガex',     en: 'Mega Greninja ex',    s: 'Pokémon', hp: '350', types: ['Water'],     rarity: 'UR',  evo: 'Frogadier' },
]

const CARD_ROWS = CARDS_RAW.map(c => ({
  id:           `ja-M4-${c.n}`,
  name:         c.ja,
  english_name: c.en,
  card_language:'ja',
  set_id:       'ja-M4',
  set_name:     'ニンジャスピナー',
  series:       'ポケモンカードゲーム MEGA',
  release_date: '2026-03-13',
  supertype:    c.s,
  hp:           c.hp,
  types:        c.types.length ? c.types : null,
  evolves_from: c.evo,
  number:       c.n,
  rarity:       c.rarity,
  image_small:  img(c.n),
  image_large:  img(c.n),
  jp_image_small: null,
  jp_image_large: null,
  is_wotc:      false,
}))

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – Ninja Spinner (ニンジャスピナー) Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
console.log(`Set: ja-M4 | ${SET.total} cards | Release: ${SET.release_date}\n`)

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
console.log('  ✓ Set ja-M4 upserted')

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
    console.error(`  Batch ${Math.floor(i / BATCH) + 1} failed:`, cardErr.message)
    process.exit(1)
  }
  written += batch.length
  process.stdout.write(`  ${written}/${CARD_ROWS.length} written...\r`)
}

console.log(`\n  ✓ All ${written} cards upserted`)
console.log('\nDone. Images served from Limitless CDN.')
