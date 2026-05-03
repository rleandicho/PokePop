#!/usr/bin/env node
/**
 * PokePop - PkmnCards gap importer/auditor
 *
 * PkmnCards has newer promo scans before the PokemonTCG API data catches up.
 * This script scrapes set pages, compares them with Supabase tcg_cards, and
 * can upsert selected safe mappings.
 *
 * Safe default:
 *   node scripts/import-pkmncards.mjs --set-code MEP
 *
 * Apply a mapped set:
 *   node scripts/import-pkmncards.mjs --set-code MEP --apply
 *
 * Full site audit, no DB writes:
 *   node scripts/import-pkmncards.mjs --all
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

const USER_AGENT = 'PokePop-PkmnCards-Audit/1.0 (+https://pkmncards.com)'
const SETS_URL = 'https://pkmncards.com/sets/'

// Only include mappings we are comfortable writing into this database.
// Full-site audit is supported, but apply mode is intentionally mapping-gated
// because PkmnCards set codes differ from PokemonTCG API ids for many old sets.
const SAFE_SET_MAPPINGS = {
  MEP: {
    dbSetId: 'mep',
    name: 'Mega Evolution Promos',
    series: 'Mega Evolution',
    cardLanguage: 'en',
    idNumberFormat: 'unpadded',
  },
  SVP: {
    dbSetId: 'svp',
    name: 'Scarlet & Violet Promos',
    series: 'Scarlet & Violet',
    cardLanguage: 'en',
    idNumberFormat: 'unpadded',
  },
  SMP: {
    dbSetId: 'smp',
    name: 'Sun & Moon Promos',
    series: 'Sun & Moon',
    cardLanguage: 'en',
    idNumberFormat: 'raw',
  },
  XYP: {
    dbSetId: 'xyp',
    name: 'XY Promos',
    series: 'XY',
    cardLanguage: 'en',
    idNumberFormat: 'raw',
  },
  BWP: {
    dbSetId: 'bwp',
    name: 'Black & White Promos',
    series: 'Black & White',
    cardLanguage: 'en',
    idNumberFormat: 'raw',
  },
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const all = args.includes('--all')
const details = args.includes('--details') || args.includes('--apply')
const setCodeArg = valueAfter('--set-code')?.toUpperCase()
const setUrlArg = valueAfter('--set-url')

function valueAfter(flag) {
  const idx = args.indexOf(flag)
  return idx === -1 ? null : args[idx + 1]
}

if (!all && !setCodeArg && !setUrlArg) {
  console.error('Usage:')
  console.error('  node scripts/import-pkmncards.mjs --set-code MEP [--apply] [--details]')
  console.error('  node scripts/import-pkmncards.mjs --set-url https://pkmncards.com/set/... [--details]')
  console.error('  node scripts/import-pkmncards.mjs --all')
  process.exit(1)
}

if (apply && !setCodeArg) {
  console.error('ERROR: --apply requires --set-code so the DB set mapping is explicit.')
  process.exit(1)
}

if (apply && !SAFE_SET_MAPPINGS[setCodeArg]) {
  console.error(`ERROR: ${setCodeArg} is not in SAFE_SET_MAPPINGS. Add a reviewed mapping before applying.`)
  process.exit(1)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.text()
}

function decodeHtml(text = '') {
  const named = {
    amp: '&',
    apos: "'",
    hellip: '...',
    ldquo: '"',
    lsquo: "'",
    mdash: '-',
    ndash: '-',
    nbsp: ' ',
    quot: '"',
    rdquo: '"',
    rsquo: "'",
  }
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, n) => named[n.toLowerCase()] ?? `&${n};`)
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(html = '') {
  return decodeHtml(html.replace(/<[^>]*>/g, ''))
}

function attr(html, name) {
  const m = html.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return m ? decodeHtml(m[1]) : null
}

function parseSetCode(label) {
  const m = label.match(/\(([^)]+)\)\s*$/)
  return m ? m[1].trim().toUpperCase() : null
}

function parseTitle(title) {
  const m = title.match(/^(.+?)\s+·\s+(.+?)(?:\s+\(([A-Z0-9]+)\))?\s+#([A-Za-z0-9-]+)$/)
  if (!m) return null
  return {
    name: m[1].trim(),
    setName: m[2].trim(),
    setCode: m[3]?.trim().toUpperCase() ?? null,
    number: m[4].trim(),
  }
}

function normalizeNumberForId(number, format) {
  if (format === 'unpadded' && /^\d+$/.test(number)) return String(Number(number))
  return number
}

function inferSupertype(name) {
  if (/\bEnergy\b/i.test(name)) return 'Energy'
  if (/\b(Amulet|Ball|Belt|Board|Cape|Candy|Carrier|Catcher|Crystal|Fan|Fanfare|Gear|Hammer|Incense|Lantern|Letter|Map|Patch|Potion|Radar|Rod|Rope|Search|Switch|Ticket|Tool|Vacuum|Vessel)\b/i.test(name)) return 'Trainer'
  return 'Pokémon'
}

function inferSubtypes({ rarity, setName }) {
  const out = []
  if (/Promo/i.test(rarity) || /Promo/i.test(setName)) out.push('Promo')
  return out
}

function parseCardDetails(html) {
  const title = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  const titleInfo = parseTitle(title)
  const plain = stripTags(html)
  const hpColorBlock = html.match(/<div class="name-hp-color"[\s\S]*?<\/div>/i)?.[0] ?? ''
  const typeBlock = html.match(/<span class="type"[\s\S]*?<\/span>/i)?.[0] ?? ''
  const evolvesBlock = html.match(/<span class="evolves"[\s\S]*?<\/span>/i)?.[0] ?? ''
  const hp = plain.match(/·\s*(\d+)\s+HP\b/i)?.[1] ?? null
  const artist = plain.match(/illus\.\s+(.+?)(?:Promos|Mark:|External:|$)/i)?.[1]?.trim() ?? null
  const releaseDate = plain.match(/↘\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/)?.[1] ?? null
  const rarity = plain.match(/#\s*0*\d+\s*:\s*([^·]+?)\s*·/)?.[1]?.trim() ?? null
  const color = hpColorBlock.match(/<abbr title="([^"]+)"/i)?.[1] ?? null
  const supertype = stripTags(typeBlock) || null
  const evolvesFrom = evolvesBlock.match(/Evolves from\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] ?? null
  return {
    ...titleInfo,
    hp,
    artist,
    rarity,
    releaseDate: releaseDate ? new Date(releaseDate).toISOString().slice(0, 10) : null,
    supertype,
    evolvesFrom: evolvesFrom ? decodeHtml(evolvesFrom) : null,
    types: color ? [decodeHtml(color)] : [],
  }
}

async function extractSetLinks() {
  const html = await fetchHtml(SETS_URL)
  const sections = html.split(/<h2[^>]*>/i).slice(1)
  const links = []

  for (const section of sections) {
    const heading = stripTags(section.split(/<\/h2>/i)[0] ?? '')
    const body = section.split(/<\/h2>/i).slice(1).join('</h2>')
    for (const m of body.matchAll(/<a\s+href="([^"]*\/set\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = stripTags(m[2])
      const code = parseSetCode(label)
      if (!label) continue
      links.push({ url: m[1], label, code, series: heading })
    }
  }

  const seen = new Set()
  return links.filter(link => {
    const key = link.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function scrapeSet(setInfo) {
  const html = await fetchHtml(setInfo.url)
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? []
  const cards = []

  for (const article of articles) {
    const link = article.match(/<a\b[^>]*class="[^"]*card-image-link[^"]*"[^>]*>[\s\S]*?<\/a>/i)?.[0]
    if (!link) continue
    const title = attr(link, 'title')
    const pageUrl = attr(link, 'href')
    const img = link.match(/<img\b[^>]*>/i)?.[0] ?? ''
    const imageUrl = attr(img, 'src')
    const parsed = parseTitle(title ?? '')
    if (!parsed || !imageUrl) continue
    cards.push({
      ...parsed,
      setCode: parsed.setCode ?? setInfo.code,
      pageUrl,
      imageUrl,
      hp: null,
      artist: null,
      rarity: null,
      releaseDate: null,
      types: [],
    })
  }

  if (details) {
    let done = 0
    for (const card of cards) {
      if (!card.pageUrl) continue
      const cardHtml = await fetchHtml(card.pageUrl)
      Object.assign(card, parseCardDetails(cardHtml))
      done++
      if (done % 10 === 0) process.stdout.write(`\r  detail pages: ${done}/${cards.length}`)
      await sleep(120)
    }
    if (cards.length) process.stdout.write(`\r  detail pages: ${cards.length}/${cards.length}\n`)
  }

  return cards
}

async function fetchExistingCards(dbSetId) {
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id, name, number, set_id, set_name, series, release_date, image_small, image_large')
    .eq('set_id', dbSetId)
    .order('number')
  if (error) throw new Error(`Supabase card fetch failed: ${error.message}`)
  return data ?? []
}

async function fetchExistingSet(dbSetId) {
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('*')
    .eq('id', dbSetId)
    .maybeSingle()
  if (error) throw new Error(`Supabase set fetch failed: ${error.message}`)
  return data
}

function summarizeDiff(scraped, existing) {
  const existingByNumber = new Map(existing.map(row => [String(row.number).replace(/^0+(?=\d)/, ''), row]))
  const missing = []
  const changed = []

  for (const card of scraped) {
    const key = String(card.number).replace(/^0+(?=\d)/, '')
    const row = existingByNumber.get(key)
    if (!row) {
      missing.push(card)
      continue
    }
    const imageChanged = row.image_large !== card.imageUrl && row.image_small !== card.imageUrl
    const nameChanged = row.name !== card.name
    if (imageChanged || nameChanged) changed.push({ scraped: card, existing: row, imageChanged, nameChanged })
  }

  return { missing, changed }
}

function toRows(cards, setInfo, mapping) {
  const releaseDates = cards.map(c => c.releaseDate).filter(Boolean).sort()
  const setRow = {
    id: mapping.dbSetId,
    name: mapping.name ?? setInfo.label.replace(/\s*\([^)]+\)\s*$/, ''),
    series: mapping.series ?? setInfo.series ?? null,
    printed_total: cards.length,
    total: cards.length,
    release_date: releaseDates[0] ?? null,
    symbol_url: null,
    logo_url: null,
  }

  const cardRows = cards.map(card => {
    const idNumber = normalizeNumberForId(card.number, mapping.idNumberFormat)
    return {
      id: `${mapping.dbSetId}-${idNumber}`,
      name: card.name,
      supertype: card.supertype ?? inferSupertype(card.name),
      subtypes: inferSubtypes({ rarity: card.rarity, setName: setRow.name }),
      hp: card.hp,
      types: card.types,
      evolves_from: card.evolvesFrom ?? null,
      number: idNumber,
      artist: card.artist,
      rarity: card.rarity ?? 'Promo',
      flavor_text: null,
      set_id: mapping.dbSetId,
      set_name: setRow.name,
      series: setRow.series,
      release_date: card.releaseDate ?? setRow.release_date,
      image_small: card.imageUrl,
      image_large: card.imageUrl,
      is_wotc: false,
      card_language: mapping.cardLanguage ?? 'en',
      english_name: card.name,
    }
  })

  return { setRow, cardRows }
}

async function upsertRows(setRow, cardRows) {
  const { error: setError } = await supabase
    .from('tcg_sets')
    .upsert(setRow, { onConflict: 'id', ignoreDuplicates: false })
  if (setError) throw new Error(`Set upsert failed: ${setError.message}`)

  for (let i = 0; i < cardRows.length; i += 200) {
    const batch = cardRows.slice(i, i + 200)
    const { error } = await supabase
      .from('tcg_cards')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
    if (error) throw new Error(`Card upsert failed: ${error.message}`)
  }
}

function printCards(label, cards, limit = 30) {
  console.log(`\n${label}: ${cards.length}`)
  for (const card of cards.slice(0, limit)) {
    console.log(`  #${card.number} ${card.name}`)
  }
  if (cards.length > limit) console.log(`  ... ${cards.length - limit} more`)
}

async function runOne(setInfo, mapping = null) {
  console.log(`\n-- ${setInfo.label} --`)
  console.log(`Source: ${setInfo.url}`)

  const scraped = await scrapeSet(setInfo)
  console.log(`Scraped cards: ${scraped.length}`)

  if (!mapping) {
    printCards('Scraped sample', scraped, 10)
    return { scraped, missing: [], changed: [] }
  }

  const existingSet = await fetchExistingSet(mapping.dbSetId)
  const existingCards = await fetchExistingCards(mapping.dbSetId)
  const { missing, changed } = summarizeDiff(scraped, existingCards)
  const { setRow, cardRows } = toRows(scraped, setInfo, mapping)

  console.log(`DB set id: ${mapping.dbSetId}`)
  console.log(`Existing set: ${existingSet ? `${existingSet.name} / ${existingSet.series} / total ${existingSet.total}` : 'none'}`)
  console.log(`Proposed set: ${setRow.name} / ${setRow.series} / total ${setRow.total} / release ${setRow.release_date ?? 'unknown'}`)
  console.log(`Existing DB cards: ${existingCards.length}`)
  printCards('Missing by card number', missing)
  printCards('Changed name/image by card number', changed.map(c => c.scraped), 20)

  if (apply) {
    console.log('\nApplying upsert...')
    await upsertRows(setRow, cardRows)
    console.log(`Applied: 1 set row, ${cardRows.length} card rows.`)
  } else {
    console.log('\nDry run only. Re-run with --apply to write this mapped set.')
  }

  return { scraped, missing, changed }
}

console.log(`PokePop PkmnCards Importer ${apply ? '[APPLY]' : '[DRY RUN]'}`)
console.log(`Details: ${details ? 'yes' : 'no'}`)

const links = await extractSetLinks()

if (all) {
  console.log(`Found ${links.length} PkmnCards set links.`)
  const mapped = links.filter(link => link.code && SAFE_SET_MAPPINGS[link.code])
  const unmapped = links.length - mapped.length
  console.log(`Mapped/importable sets: ${mapped.map(l => l.code).join(', ') || 'none'}`)
  console.log(`Unmapped audit-only sets: ${unmapped}`)

  for (const link of mapped) {
    await runOne(link, SAFE_SET_MAPPINGS[link.code])
  }
} else {
  const setInfo = setUrlArg
    ? { url: setUrlArg, label: setUrlArg, code: setCodeArg, series: null }
    : links.find(link => link.code === setCodeArg)

  if (!setInfo) {
    console.error(`ERROR: Could not find set code ${setCodeArg} on ${SETS_URL}`)
    process.exit(1)
  }

  await runOne(setInfo, setCodeArg ? SAFE_SET_MAPPINGS[setCodeArg] : null)
}
