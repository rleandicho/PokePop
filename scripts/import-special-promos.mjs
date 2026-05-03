#!/usr/bin/env node
/**
 * PokePop - special promo importer
 *
 * Handles stamped/reprint promo groups that are not modeled as normal sets by
 * PkmnCards or the PokemonTCG API, such as Trick-or-Trade, Toys"R"Us, and
 * Build-A-Bear Workshop cards.
 *
 * Dry run:
 *   node scripts/import-special-promos.mjs
 *
 * Apply:
 *   node scripts/import-special-promos.mjs --apply
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '..', '.env')

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
const apply = process.argv.includes('--apply')

const TRICK_SETS = [
  {
    id: 'trt22',
    name: 'Trick or Trade BOOster Bundle 2022',
    release_date: '2022-09-01',
    url: 'https://www.pokellector.com/Trick-or-Trade-Collection/',
  },
  {
    id: 'trt23',
    name: 'Trick or Trade BOOster Bundle 2023',
    release_date: '2023-09-01',
    url: 'https://www.pokellector.com/Trick-or-Trade-2023-Collection/',
  },
  {
    id: 'trt24',
    name: 'Trick or Trade BOOster Bundle 2024',
    release_date: '2024-08-30',
    url: 'https://www.pokellector.com/Trick-or-Trade-2024-Collection/',
  },
]

const TOYS_R_US = [
  ['Tangela', '8/83', 'xy5', '4'],
  ['Ponyta', '14/83', 'xy2', '14'],
  ['Magikarp', '22/83', 'xy7', '19'],
  ['Pikachu', '26/83', 'xy1', '42'],
  ['Slowpoke', '32/83', 'g1', '32'],
  ['Geodude', '43/83', 'xy2', '45'],
  ['Clefairy', '50/83', 'xy3', '69'],
  ['Meowth', '53/83', 'xy8', '114'],
  ['Charmander', '9/108', 'xy12', '9'],
  ['Electabuzz', '41/108', 'xy12', '41'],
  ['Cosmog', '64/149', 'sm1', '64'],
  ['Alolan Vulpix', '21/145', 'sm2', '21'],
  ['Stufful', '110/147', 'sm3', '110'],
  ['Jangmo-o', '75/111', 'sm4', '75'],
  ['Piplup', '32/156', 'sm5', '32'],
]

const BUILD_A_BEAR = [
  ['Pikachu', '20/108', 'xy12', '35'],
  ['Eevee', '63/98', 'xy7', '63'],
  ['Meowth', '67/108', 'xy12', '67'],
  ['Jigglypuff', '71/111', 'sm4', '71'],
  ['Snorlax', '80/106', 'xy2', '80'],
  ['Alolan Vulpix', '21/145', 'sm2', '21'],
  ['Charmander', '17/113', 'sm3', '18'],
  ['Snubbull', '90/149', 'sm1', '90'],
  ['Squirtle', '14/101', 'sm75', '14'],
  ['Pikachu', 'SM86', 'smp', 'SM86'],
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function decodeHtml(text = '') {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function largePokellectorImage(url) {
  return url.replace(/\.thumb(\.[a-z]+)$/i, '$1')
}

function slugPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function rowFromStampedPromo({ setId, setName, releaseDate, name, number, baseCard }) {
  return {
    id: `${setId}-${slugPart(number)}-${slugPart(name)}`,
    name,
    supertype: baseCard?.supertype ?? 'Pokémon',
    subtypes: ['Promo'],
    hp: baseCard?.hp ?? null,
    types: baseCard?.types ?? [],
    evolves_from: baseCard?.evolves_from ?? null,
    number,
    artist: baseCard?.artist ?? null,
    rarity: 'Promo',
    flavor_text: baseCard?.flavor_text ?? null,
    set_id: setId,
    set_name: setName,
    series: 'Special Promos',
    release_date: releaseDate,
    image_small: baseCard?.image_small ?? null,
    image_large: baseCard?.image_large ?? null,
    is_wotc: false,
    card_language: 'en',
    english_name: name,
  }
}

async function fetchBaseCard(setId, number, name) {
  let query = supabase
    .from('tcg_cards')
    .select('*')
    .eq('set_id', setId)
    .eq('number', number)
    .limit(1)

  let { data } = await query
  if (data?.[0]) return data[0]

  const { data: fallback } = await supabase
    .from('tcg_cards')
    .select('*')
    .ilike('name', name)
    .eq('number', number)
    .limit(1)
  return fallback?.[0] ?? null
}

async function fetchPokellectorCollection(def) {
  const html = await (await fetch(def.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 PokePop-SpecialPromos/1.0' },
  })).text()

  const rows = []
  const re = /<a href="([^"]+)"[^>]+title="([^"]+)"[\s\S]*?<img class="card lazyload" data-src="([^"]+)"[\s\S]*?<div class="plaque">#([^<]+)<\/div>/g
  for (const m of html.matchAll(re)) {
    const title = decodeHtml(m[2])
    const plaque = decodeHtml(m[4])
    const titleMatch = title.match(/^(.+?)\s+-\s+(.+?)\s+#(.+)$/)
    const plaqueMatch = plaque.match(/^(.+?)\s+-\s+(.+)$/)
    const name = plaqueMatch?.[2]?.trim() ?? titleMatch?.[1]?.trim()
    const number = plaqueMatch?.[1]?.trim() ?? titleMatch?.[3]?.trim()
    if (!name || !number) continue

    rows.push({
      id: `${def.id}-${slugPart(number)}-${slugPart(name)}`,
      name,
      supertype: 'Pokémon',
      subtypes: ['Promo'],
      hp: null,
      types: [],
      evolves_from: null,
      number,
      artist: null,
      rarity: 'Promo',
      flavor_text: null,
      set_id: def.id,
      set_name: def.name,
      series: 'Special Promos',
      release_date: def.release_date,
      image_small: m[3],
      image_large: largePokellectorImage(m[3]),
      is_wotc: false,
      card_language: 'en',
      english_name: name,
    })
  }
  return rows
}

async function buildManualRows(setId, setName, releaseDate, defs) {
  const rows = []
  for (const [name, printedNumber, baseSetId, baseNumber] of defs) {
    const baseCard = await fetchBaseCard(baseSetId, baseNumber, name)
    rows.push(rowFromStampedPromo({
      setId,
      setName,
      releaseDate,
      name,
      number: printedNumber,
      baseCard,
    }))
  }
  return rows
}

async function existingCount(setId) {
  const { count, error } = await supabase
    .from('tcg_cards')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', setId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function upsertSet(setRow) {
  const { error } = await supabase
    .from('tcg_sets')
    .upsert(setRow, { onConflict: 'id', ignoreDuplicates: false })
  if (error) throw new Error(`Set upsert failed: ${error.message}`)
}

async function upsertCards(rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('tcg_cards')
      .upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: false })
    if (error) throw new Error(`Card upsert failed: ${error.message}`)
  }
}

async function handleSet({ id, name, release_date, rows }) {
  const before = await existingCount(id)
  const setRow = {
    id,
    name,
    series: 'Special Promos',
    printed_total: rows.length,
    total: rows.length,
    release_date,
    symbol_url: null,
    logo_url: null,
  }

  console.log(`\n${id} - ${name}`)
  console.log(`Existing DB cards: ${before}`)
  console.log(`Rows prepared:     ${rows.length}`)
  console.log(rows.slice(0, 8).map(r => `  #${r.number} ${r.name}`).join('\n'))
  if (rows.length > 8) console.log(`  ... ${rows.length - 8} more`)

  if (!apply) return
  await upsertSet(setRow)
  await upsertCards(rows)
  const after = await existingCount(id)
  console.log(`Applied. DB cards now: ${after}`)
}

console.log(`PokePop Special Promo Importer ${apply ? '[APPLY]' : '[DRY RUN]'}`)

for (const def of TRICK_SETS) {
  const rows = await fetchPokellectorCollection(def)
  await handleSet({ ...def, rows })
  await sleep(250)
}

await handleSet({
  id: 'toysrus',
  name: 'Toys "R" Us Promotional Cards',
  release_date: '2016-02-26',
  rows: await buildManualRows('toysrus', 'Toys "R" Us Promotional Cards', '2016-02-26', TOYS_R_US),
})

await handleSet({
  id: 'buildabear',
  name: 'Build-A-Bear Workshop Promotional Cards',
  release_date: '2016-12-01',
  rows: await buildManualRows('buildabear', 'Build-A-Bear Workshop Promotional Cards', '2016-12-01', BUILD_A_BEAR),
})

if (!apply) console.log('\nDry run only. Re-run with --apply to write these special promo sets.')
