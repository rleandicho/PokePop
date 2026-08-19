#!/usr/bin/env node
/**
 * PokePop – Pitch Black (PBL) Importer
 *
 * Imports the English set "Pitch Black" (set code PBL, TCGDex me05) into
 * tcg_sets and tcg_cards. PBL is the English equivalent of Japanese M5
 * "Abyss Eye" (アビスアイ), released July 17 2026.
 *
 * The English set adds three cards not in the Japanese version:
 *   - Mega Delphox ex (008/084, Fire, Double Rare)
 *   - Mega Slowbro ex (031/084, Psychic, Double Rare)
 *   - Jett (079/084, Supporter, Uncommon)
 * …bringing the printed total to 84 (vs 81 in M5) and secret total to 120.
 *
 * Images: Limitless TCG CDN — confirmed URL pattern for PBL.
 *
 * Dry run (default):
 *   node scripts/import-pitch-black.mjs
 *
 * Apply:
 *   node scripts/import-pitch-black.mjs --apply
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

// Image URL helpers — Limitless CDN
const img  = n => `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/PBL/PBL_${String(n).padStart(3, '0')}_R_EN_LG.png`
const imgS = n => img(n)  // same CDN serves both sizes; swap suffix if needed

// ── Set metadata ──────────────────────────────────────────────────────────────
const SET = {
  id:            'pbl',
  name:          'Pitch Black',
  series:        'Mega Evolution',
  printed_total: 84,
  total:         120,
  release_date:  '2026-07-17',
  symbol_url:    null,
  logo_url:      null,
}

// ── Card list ─────────────────────────────────────────────────────────────────
// Sources: Limitless TCG, Bulbapedia, TCGDex me05
// n  = card number (string, zero-padded)
// s  = supertype
// evo = evolves_from (null for basics/standalone ex/trainers)
// hp  = null for English-exclusive Mega ex cards pending confirmation
const CARDS_RAW = [
  // ── Grass ──
  { n: '001', name: 'Tropius',            s: 'Pokémon',  hp: '110', types: ['Grass'],     rarity: 'Common',                    evo: null          },
  { n: '002', name: 'Grubbin',            s: 'Pokémon',  hp: '70',  types: ['Grass'],     rarity: 'Common',                    evo: null          },
  { n: '003', name: 'Fomantis',           s: 'Pokémon',  hp: '70',  types: ['Grass'],     rarity: 'Common',                    evo: null          },
  { n: '004', name: 'Lurantis ex',        s: 'Pokémon',  hp: '260', types: ['Grass'],     rarity: 'Double Rare',               evo: 'Fomantis'    },
  { n: '005', name: 'Poltchageist',       s: 'Pokémon',  hp: '30',  types: ['Grass'],     rarity: 'Common',                    evo: null          },
  { n: '006', name: 'Sinistcha',          s: 'Pokémon',  hp: '60',  types: ['Grass'],     rarity: 'Uncommon',                  evo: 'Poltchageist'},
  // ── Fire ──
  { n: '007', name: 'Heatran',            s: 'Pokémon',  hp: '140', types: ['Fire'],      rarity: 'Uncommon',                  evo: null          },
  { n: '008', name: 'Mega Delphox ex',    s: 'Pokémon',  hp: null,  types: ['Fire'],      rarity: 'Double Rare',               evo: null          }, // EN exclusive; HP TBC
  { n: '009', name: 'Sizzlipede',         s: 'Pokémon',  hp: '80',  types: ['Fire'],      rarity: 'Common',                    evo: null          },
  { n: '010', name: 'Centiskorch',        s: 'Pokémon',  hp: '140', types: ['Fire'],      rarity: 'Common',                    evo: 'Sizzlipede'  },
  { n: '011', name: 'Charcadet',          s: 'Pokémon',  hp: '80',  types: ['Fire'],      rarity: 'Common',                    evo: null          },
  { n: '012', name: 'Armarouge',          s: 'Pokémon',  hp: '140', types: ['Fire'],      rarity: 'Rare',                      evo: 'Charcadet'   },
  // ── Water ──
  { n: '013', name: 'Goldeen',            s: 'Pokémon',  hp: '70',  types: ['Water'],     rarity: 'Common',                    evo: null          },
  { n: '014', name: 'Seaking',            s: 'Pokémon',  hp: '110', types: ['Water'],     rarity: 'Uncommon',                  evo: 'Goldeen'     },
  { n: '015', name: 'Wailmer',            s: 'Pokémon',  hp: '130', types: ['Water'],     rarity: 'Common',                    evo: null          },
  { n: '016', name: 'Wailord ex',         s: 'Pokémon',  hp: '380', types: ['Water'],     rarity: 'Double Rare',               evo: 'Wailmer'     },
  { n: '017', name: 'Relicanth',          s: 'Pokémon',  hp: '100', types: ['Water'],     rarity: 'Uncommon',                  evo: null          },
  { n: '018', name: 'Popplio',            s: 'Pokémon',  hp: '70',  types: ['Water'],     rarity: 'Common',                    evo: null          },
  { n: '019', name: 'Brionne',            s: 'Pokémon',  hp: '90',  types: ['Water'],     rarity: 'Common',                    evo: 'Popplio'     },
  { n: '020', name: 'Primarina',          s: 'Pokémon',  hp: '150', types: ['Water'],     rarity: 'Rare',                      evo: 'Brionne'     },
  { n: '021', name: 'Finizen',            s: 'Pokémon',  hp: '80',  types: ['Water'],     rarity: 'Common',                    evo: null          },
  { n: '022', name: 'Palafin',            s: 'Pokémon',  hp: '150', types: ['Water'],     rarity: 'Uncommon',                  evo: 'Finizen'     },
  // ── Lightning ──
  { n: '023', name: 'Electrike',          s: 'Pokémon',  hp: '70',  types: ['Lightning'], rarity: 'Common',                    evo: null          },
  { n: '024', name: 'Manectric',          s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'Uncommon',                  evo: 'Electrike'   },
  { n: '025', name: 'Charjabug',          s: 'Pokémon',  hp: '100', types: ['Lightning'], rarity: 'Common',                    evo: 'Grubbin'     },
  { n: '026', name: 'Vikavolt',           s: 'Pokémon',  hp: '160', types: ['Lightning'], rarity: 'Uncommon',                  evo: 'Charjabug'   },
  { n: '027', name: 'Mega Zeraora ex',    s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'Double Rare',               evo: null          },
  { n: '028', name: 'Miraidon',           s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'Rare',                      evo: null          },
  // ── Psychic ──
  { n: '029', name: 'Slowpoke',           s: 'Pokémon',  hp: '70',  types: ['Psychic'],   rarity: 'Common',                    evo: null          },
  { n: '030', name: 'Slowbro',            s: 'Pokémon',  hp: '130', types: ['Psychic'],   rarity: 'Uncommon',                  evo: 'Slowpoke'    },
  { n: '031', name: 'Mega Slowbro ex',    s: 'Pokémon',  hp: null,  types: ['Psychic'],   rarity: 'Double Rare',               evo: null          }, // EN exclusive; HP TBC
  { n: '032', name: 'Jynx',              s: 'Pokémon',  hp: '100', types: ['Psychic'],   rarity: 'Common',                    evo: null          },
  { n: '033', name: 'Shuppet',            s: 'Pokémon',  hp: '50',  types: ['Psychic'],   rarity: 'Common',                    evo: null          },
  { n: '034', name: 'Banette',            s: 'Pokémon',  hp: '80',  types: ['Psychic'],   rarity: 'Uncommon',                  evo: 'Shuppet'     },
  { n: '035', name: 'Spiritomb',          s: 'Pokémon',  hp: '60',  types: ['Psychic'],   rarity: 'Rare',                      evo: null          },
  { n: '036', name: 'Litwick',            s: 'Pokémon',  hp: '70',  types: ['Psychic'],   rarity: 'Common',                    evo: null          },
  { n: '037', name: 'Lampent',            s: 'Pokémon',  hp: '90',  types: ['Psychic'],   rarity: 'Uncommon',                  evo: 'Litwick'     },
  { n: '038', name: 'Mega Chandelure ex', s: 'Pokémon',  hp: '350', types: ['Psychic'],   rarity: 'Double Rare',               evo: 'Lampent'     },
  { n: '039', name: 'Dhelmise',           s: 'Pokémon',  hp: '60',  types: ['Psychic'],   rarity: 'Uncommon',                  evo: null          },
  { n: '040', name: 'Marshadow',          s: 'Pokémon',  hp: '90',  types: ['Psychic'],   rarity: 'Uncommon',                  evo: null          },
  { n: '041', name: 'Annihilape',         s: 'Pokémon',  hp: '150', types: ['Psychic'],   rarity: 'Uncommon',                  evo: 'Primeape'    },
  // ── Fighting ──
  { n: '042', name: 'Mankey',             s: 'Pokémon',  hp: '50',  types: ['Fighting'],  rarity: 'Common',                    evo: null          },
  { n: '043', name: 'Primeape',           s: 'Pokémon',  hp: '110', types: ['Fighting'],  rarity: 'Common',                    evo: 'Mankey'      },
  { n: '044', name: 'Cranidos',           s: 'Pokémon',  hp: '100', types: ['Fighting'],  rarity: 'Common',                    evo: null          },
  { n: '045', name: 'Rampardos ex',       s: 'Pokémon',  hp: '330', types: ['Fighting'],  rarity: 'Double Rare',               evo: 'Cranidos'    },
  { n: '046', name: 'Drilbur',            s: 'Pokémon',  hp: '70',  types: ['Fighting'],  rarity: 'Common',                    evo: null          },
  { n: '047', name: 'Koraidon',           s: 'Pokémon',  hp: '130', types: ['Fighting'],  rarity: 'Rare',                      evo: null          },
  // ── Darkness ──
  { n: '048', name: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'],  rarity: 'Double Rare',               evo: null          },
  { n: '049', name: 'Vullaby',            s: 'Pokémon',  hp: '70',  types: ['Darkness'],  rarity: 'Common',                    evo: null          },
  { n: '050', name: 'Mandibuzz',          s: 'Pokémon',  hp: '120', types: ['Darkness'],  rarity: 'Common',                    evo: 'Vullaby'     },
  { n: '051', name: 'Inkay',              s: 'Pokémon',  hp: '60',  types: ['Darkness'],  rarity: 'Common',                    evo: null          },
  { n: '052', name: 'Malamar',            s: 'Pokémon',  hp: '120', types: ['Darkness'],  rarity: 'Uncommon',                  evo: 'Inkay'       },
  { n: '053', name: 'Nickit',             s: 'Pokémon',  hp: '70',  types: ['Darkness'],  rarity: 'Common',                    evo: null          },
  { n: '054', name: 'Thievul',            s: 'Pokémon',  hp: '100', types: ['Darkness'],  rarity: 'Uncommon',                  evo: 'Nickit'      },
  { n: '055', name: 'Morpeko ex',         s: 'Pokémon',  hp: '180', types: ['Darkness'],  rarity: 'Double Rare',               evo: null          },
  { n: '056', name: 'Zarude',             s: 'Pokémon',  hp: '130', types: ['Darkness'],  rarity: 'Rare',                      evo: null          },
  { n: '057', name: 'Maschiff',           s: 'Pokémon',  hp: '70',  types: ['Darkness'],  rarity: 'Common',                    evo: null          },
  { n: '058', name: 'Mabosstiff',         s: 'Pokémon',  hp: '140', types: ['Darkness'],  rarity: 'Common',                    evo: 'Maschiff'    },
  { n: '059', name: 'Chi-Yu',             s: 'Pokémon',  hp: '90',  types: ['Darkness'],  rarity: 'Rare',                      evo: null          },
  // ── Metal ──
  { n: '060', name: 'Skarmory',           s: 'Pokémon',  hp: '120', types: ['Metal'],     rarity: 'Common',                    evo: null          },
  { n: '061', name: 'Shieldon',           s: 'Pokémon',  hp: '100', types: ['Metal'],     rarity: 'Common',                    evo: null          },
  { n: '062', name: 'Bastiodon',          s: 'Pokémon',  hp: '160', types: ['Metal'],     rarity: 'Rare',                      evo: 'Shieldon'    },
  { n: '063', name: 'Bronzor',            s: 'Pokémon',  hp: '80',  types: ['Metal'],     rarity: 'Common',                    evo: null          },
  { n: '064', name: 'Bronzong',           s: 'Pokémon',  hp: '130', types: ['Metal'],     rarity: 'Uncommon',                  evo: 'Bronzor'     },
  { n: '065', name: 'Mega Excadrill ex',  s: 'Pokémon',  hp: '340', types: ['Metal'],     rarity: 'Double Rare',               evo: 'Drilbur'     },
  // ── Colorless ──
  { n: '066', name: 'Pikipek',            s: 'Pokémon',  hp: '70',  types: ['Colorless'], rarity: 'Common',                    evo: null          },
  { n: '067', name: 'Trumbeak',           s: 'Pokémon',  hp: '90',  types: ['Colorless'], rarity: 'Common',                    evo: 'Pikipek'     },
  { n: '068', name: 'Toucannon',          s: 'Pokémon',  hp: '150', types: ['Colorless'], rarity: 'Uncommon',                  evo: 'Trumbeak'    },
  { n: '069', name: 'Type: Null',         s: 'Pokémon',  hp: '110', types: ['Colorless'], rarity: 'Common',                    evo: null          },
  { n: '070', name: 'Silvally',           s: 'Pokémon',  hp: '140', types: ['Colorless'], rarity: 'Rare',                      evo: 'Type: Null'  },
  { n: '071', name: 'Bombirdier',         s: 'Pokémon',  hp: '100', types: ['Colorless'], rarity: 'Common',                    evo: null          },
  // ── Trainers ──
  { n: '072', name: 'Antique Armor Fossil',   s: 'Trainer', hp: null, types: [], rarity: 'Common',   evo: null },
  { n: '073', name: 'Antique Skull Fossil',   s: 'Trainer', hp: null, types: [], rarity: 'Common',   evo: null },
  { n: '074', name: 'Backtrack Badge',        s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '075', name: 'Dark Bell',              s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '076', name: 'Fossil Quarry',          s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '077', name: "Gladion's Final Battle", s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '078', name: 'Gwynn',                  s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '079', name: 'Jett',                   s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null }, // EN exclusive Supporter
  { n: '080', name: "Misty's Vitality",       s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '081', name: 'Rust Syndicate Grunt',   s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  { n: '082', name: 'Tremendous Bomb',        s: 'Trainer', hp: null, types: [], rarity: 'Uncommon', evo: null },
  // ── Special Energy ──
  { n: '083', name: 'Shadowy D Energy',   s: 'Energy',  hp: null, types: ['Darkness'],  rarity: 'Rare',   evo: null },
  { n: '084', name: 'Voltaic L Energy',   s: 'Energy',  hp: null, types: ['Lightning'], rarity: 'Rare',   evo: null },
  // ── Illustration Rares (085–095) ──
  { n: '085', name: 'Fomantis',           s: 'Pokémon',  hp: '70',  types: ['Grass'],     rarity: 'Illustration Rare', evo: null         },
  { n: '086', name: 'Armarouge',          s: 'Pokémon',  hp: '140', types: ['Fire'],      rarity: 'Illustration Rare', evo: 'Charcadet'  },
  { n: '087', name: 'Goldeen',            s: 'Pokémon',  hp: '70',  types: ['Water'],     rarity: 'Illustration Rare', evo: null         },
  { n: '088', name: 'Primarina',          s: 'Pokémon',  hp: '150', types: ['Water'],     rarity: 'Illustration Rare', evo: 'Brionne'    },
  { n: '089', name: 'Manectric',          s: 'Pokémon',  hp: '120', types: ['Lightning'], rarity: 'Illustration Rare', evo: 'Electrike'  },
  { n: '090', name: 'Slowbro',            s: 'Pokémon',  hp: '130', types: ['Psychic'],   rarity: 'Illustration Rare', evo: 'Slowpoke'   },
  { n: '091', name: 'Dhelmise',           s: 'Pokémon',  hp: '60',  types: ['Psychic'],   rarity: 'Illustration Rare', evo: null         },
  { n: '092', name: 'Thievul',            s: 'Pokémon',  hp: '100', types: ['Darkness'],  rarity: 'Illustration Rare', evo: 'Nickit'     },
  { n: '093', name: 'Bastiodon',          s: 'Pokémon',  hp: '160', types: ['Metal'],     rarity: 'Illustration Rare', evo: 'Shieldon'   },
  { n: '094', name: 'Toucannon',          s: 'Pokémon',  hp: '150', types: ['Colorless'], rarity: 'Illustration Rare', evo: 'Trumbeak'   },
  { n: '095', name: 'Silvally',           s: 'Pokémon',  hp: '140', types: ['Colorless'], rarity: 'Illustration Rare', evo: 'Type: Null' },
  // ── Ultra Rares — Pokémon (096–103) ──
  { n: '096', name: 'Lurantis ex',        s: 'Pokémon',  hp: '260', types: ['Grass'],     rarity: 'Ultra Rare', evo: 'Fomantis'  },
  { n: '097', name: 'Wailord ex',         s: 'Pokémon',  hp: '380', types: ['Water'],     rarity: 'Ultra Rare', evo: 'Wailmer'   },
  { n: '098', name: 'Mega Zeraora ex',    s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'Ultra Rare', evo: null        },
  { n: '099', name: 'Mega Chandelure ex', s: 'Pokémon',  hp: '350', types: ['Psychic'],   rarity: 'Ultra Rare', evo: 'Lampent'   },
  { n: '100', name: 'Rampardos ex',       s: 'Pokémon',  hp: '330', types: ['Fighting'],  rarity: 'Ultra Rare', evo: 'Cranidos'  },
  { n: '101', name: 'Mega Darkrai ex',    s: 'Pokémon',  hp: '280', types: ['Darkness'],  rarity: 'Ultra Rare', evo: null        },
  { n: '102', name: 'Morpeko ex',         s: 'Pokémon',  hp: '180', types: ['Darkness'],  rarity: 'Ultra Rare', evo: null        },
  { n: '103', name: 'Mega Excadrill ex',  s: 'Pokémon',  hp: '340', types: ['Metal'],     rarity: 'Ultra Rare', evo: 'Drilbur'   },
  // ── Ultra Rares — Trainers (104–113) ──
  { n: '104', name: 'Brave Bangle',              s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '105', name: 'Crushing Hammer',           s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '106', name: 'Dark Bell',                 s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '107', name: 'Energy Switch',             s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '108', name: "Gladion's Final Battle",    s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '109', name: 'Gwynn',                     s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '110', name: 'Iron Defender',             s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '111', name: "Misty's Vitality",          s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '112', name: 'Rust Syndicate Grunt',      s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  { n: '113', name: 'Tremendous Bomb',           s: 'Trainer', hp: null, types: [], rarity: 'Ultra Rare', evo: null },
  // ── Special Illustration Rares (114–119) ──
  { n: '114', name: 'Mega Zeraora ex',           s: 'Pokémon',  hp: '270', types: ['Lightning'], rarity: 'Special Illustration Rare', evo: null      },
  { n: '115', name: 'Mega Chandelure ex',        s: 'Pokémon',  hp: '350', types: ['Psychic'],   rarity: 'Special Illustration Rare', evo: 'Lampent' },
  { n: '116', name: 'Mega Darkrai ex',           s: 'Pokémon',  hp: '280', types: ['Darkness'],  rarity: 'Special Illustration Rare', evo: null      },
  { n: '117', name: 'Morpeko ex',                s: 'Pokémon',  hp: '180', types: ['Darkness'],  rarity: 'Special Illustration Rare', evo: null      },
  { n: '118', name: "Gladion's Final Battle",    s: 'Trainer',  hp: null,  types: [],             rarity: 'Special Illustration Rare', evo: null      },
  { n: '119', name: 'Gwynn',                     s: 'Trainer',  hp: null,  types: [],             rarity: 'Special Illustration Rare', evo: null      },
  // ── Mega Hyper Rare (120) ──
  { n: '120', name: 'Mega Darkrai ex',           s: 'Pokémon',  hp: '280', types: ['Darkness'],  rarity: 'Mega Hyper Rare',           evo: null      },
]

// ── Build card rows ───────────────────────────────────────────────────────────
const CARD_ROWS = CARDS_RAW.map(c => ({
  id:            `pbl-${c.n}`,
  name:          c.name,
  english_name:  c.name,  // EN set — name == english_name
  card_language: 'en',
  set_id:        'pbl',
  set_name:      'Pitch Black',
  series:        'Mega Evolution',
  release_date:  '2026-07-17',
  supertype:     c.s,
  hp:            c.hp,
  types:         c.types.length ? c.types : null,
  evolves_from:  c.evo,
  number:        c.n,
  rarity:        c.rarity,
  image_small:   imgS(parseInt(c.n, 10)),
  image_large:   img(parseInt(c.n, 10)),
  jp_image_small: null,
  jp_image_large: null,
  is_wotc:       false,
}))

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPokePop – Pitch Black (PBL) Importer${apply ? '' : '  [DRY RUN — pass --apply to write]'}`)
console.log(`Set: pbl | ${SET.total} cards | Release: ${SET.release_date}\n`)

if (!apply) {
  console.log('── SET ROW ─────────────────────────────────────────')
  console.log(JSON.stringify(SET, null, 2))
  console.log(`\n── CARD ROWS (${CARD_ROWS.length}) ─────────────────────────────`)
  for (const c of CARD_ROWS) {
    console.log(`  ${c.id.padEnd(12)}  ${c.rarity.padEnd(28)}  ${c.name}`)
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
console.log(`  ✓ Set pbl upserted`)

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
console.log('\nDone!')
console.log('Note: Mega Delphox ex (008) and Mega Slowbro ex (031) have hp: null — update once confirmed.')
console.log('Tip: run the price refresh script once PBL cards are listed on TCGPlayer.')
