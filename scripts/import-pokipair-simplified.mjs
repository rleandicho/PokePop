#!/usr/bin/env node
/**
 * PokePop - Pokipair Simplified Chinese scraper
 *
 * Scrapes Pokipair set-list gallery pages for Simplified Chinese Pokemon cards.
 * Pokipair provides strong set metadata and image galleries, but most gallery
 * HTML does not expose actual card names. This importer therefore creates
 * conservative catalog rows named "<Set Code> #<number>" unless a better name is
 * available in a future source.
 *
 * Usage:
 *   node scripts/import-pokipair-simplified.mjs --dry-run
 *   node scripts/import-pokipair-simplified.mjs --manifest data/pokipair-simplified-preview.json
 *   node scripts/import-pokipair-simplified.mjs --set https://www.pokipair.com/vivid-portrayals-set-list-cs2b/ --dry-run
 *   node scripts/import-pokipair-simplified.mjs --write --allow-placeholders --limit 3
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const m = line.replace(/\r$/, '').match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const write = args.includes('--write')
const dryRun = args.includes('--dry-run') || !write
const allowPlaceholders = args.includes('--allow-placeholders')
const setIdx = args.indexOf('--set')
const limitIdx = args.indexOf('--limit')
const manifestIdx = args.indexOf('--manifest')
const singleSetUrl = setIdx !== -1 ? args[setIdx + 1] : null
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : Infinity
const manifestPath = manifestIdx !== -1 ? args[manifestIdx + 1] : null

if (write && !allowPlaceholders) {
  console.error('Refusing to write placeholder rows without --allow-placeholders.')
  console.error('Pokipair gallery HTML does not expose reliable card names; review a --manifest file first.')
  process.exit(1)
}

const INDEX_URL = 'https://www.pokipair.com/simplified-chinese-pokemon-set-list/'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; PokePop-simplified-cn-bot/1.0)' }

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function decodeHtml(text = '') {
  return text
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function absolutize(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return new URL(url, INDEX_URL).toString()
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function extractSetLinks(html) {
  const links = []
  const seen = new Set()

  const cardRegex = /<a\b[^>]*class=["']?fusion-no-lightbox["']?[^>]*href=["']([^"']+)["'][\s\S]*?<\/a>[\s\S]{0,1200}?<p>([\s\S]*?)<\/p>/gi
  let cardMatch
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const href = absolutize(cardMatch[1])
    const label = decodeHtml(cardMatch[2])
    if (!href || seen.has(href)) continue
    if (new URL(href).pathname === '/') continue
    if (!/(card list|set list|promo|collect 151|gem pack|exclusive simplified chinese)/i.test(label)) continue
    seen.add(href)
    links.push({ href, label })
  }

  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const href = absolutize(match[1])
    const label = decodeHtml(match[2])
    if (!href || seen.has(href)) continue
    if (!/pokipair\.com/.test(href)) continue
    if (!/(card list|set list|promo|collect 151|gem pack|exclusive simplified chinese)/i.test(label)) continue
    if (/simplified-chinese-pokemon-set-list/i.test(href)) continue
    seen.add(href)
    links.push({ href, label })
  }
  return links
}

function parseSetMeta(html, fallbackLabel, url) {
  const title = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    || decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
    || fallbackLabel

  const text = decodeHtml(html)
  const setNameLine = text.match(/Set Name:\s*([^:]+?)(?: Era:| Release Date:| Language:| Total Cards:|$)/i)?.[1]?.trim()
  const releaseRaw = text.match(/Release Date:\s*([^:]+?)(?: Language:| Total Cards:|$)/i)?.[1]?.trim()
  const total = Number(text.match(/Total Cards:\s*(\d+)/i)?.[1] ?? 0) || null

  const code =
    title.match(/\b(CSVL?\d+|CSV\d+|CSM\d+(?:\.\d+)?[A-C]?|CS\d+(?:\.\d+)?[A-C]?|CS\s?[A-Z]{1,3}|CSF)\b/i)?.[1]
    ?? setNameLine?.match(/\b(CSVL?\d+|CSV\d+|CSM\d+(?:\.\d+)?[A-C]?|CS\d+(?:\.\d+)?[A-C]?|CS\s?[A-Z]{1,3}|CSF)\b/i)?.[1]
    ?? fallbackLabel.match(/\b(CSVL?\d+|CSV\d+|CSM\d+(?:\.\d+)?[A-C]?|CS\d+(?:\.\d+)?[A-C]?|CS\s?[A-Z]{1,3}|CSF)\b/i)?.[1]
    ?? path.basename(new URL(url).pathname).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()

  const normalizedCode = code.replace(/\s+/g, '').toUpperCase()
  const releaseDate = parseReleaseDate(releaseRaw)
  const era = /scarlet|csv/i.test(text) ? 'Simplified Chinese - Scarlet & Violet'
    : /sword|shield|cs\d/i.test(text) ? 'Simplified Chinese - Sword & Shield'
    : /sun|moon|csm/i.test(text) ? 'Simplified Chinese - Sun & Moon'
    : 'Simplified Chinese'

  return {
    code: normalizedCode,
    setId: `zh-cn-${normalizedCode}`,
    name: setNameLine || title.replace(/\s+-\s+PokiPair Store$/i, ''),
    series: era,
    releaseDate,
    printedTotal: total,
    total,
  }
}

function parseReleaseDate(value) {
  if (!value) return null
  const cleaned = value.replace(/\bin Mainland China\b/i, '').trim()
  const date = new Date(cleaned)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function largestFromSrcset(srcset) {
  if (!srcset) return null
  const parts = srcset.split(',').map(part => part.trim()).filter(Boolean)
  const parsed = parts.map(part => {
    const [url, width] = part.split(/\s+/)
    return { url, width: Number(width?.replace(/\D/g, '') || 0) }
  })
  parsed.sort((a, b) => b.width - a.width)
  return parsed[0]?.url ?? null
}

function originalImageUrl(url) {
  if (!url) return null
  return url.replace(/-\d+x\d+(?=\.(png|jpe?g|webp)$)/i, '')
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null
}

function parseCards(html, meta) {
  const cards = []
  const imgRegex = /<img\b[^>]*>/gi
  let match
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0]
    const src = attr(tag, 'data-pagespeed-lazy-src') || attr(tag, 'data-lazy-src') || attr(tag, 'src')
    const srcset = attr(tag, 'data-pagespeed-lazy-srcset') || attr(tag, 'data-lazy-srcset') || attr(tag, 'srcset')

    const bestUrl = originalImageUrl(largestFromSrcset(srcset) || src)
    if (!bestUrl) continue
    if (!/Simplified-Chinese-Pokemon/i.test(bestUrl)) continue
    const filename = decodeURIComponent(bestUrl.split('/').pop())
    const numberRaw = filename.match(/(?:Pokemon|Promo|Pack|Cards?)-(\d+)(?:\.(?:png|jpe?g|webp))?$/i)?.[1]
      ?? filename.match(/-(\d+)(?:\.(?:png|jpe?g|webp))?$/i)?.[1]
    if (!numberRaw) continue

    const number = String(Number(numberRaw)).padStart(3, '0')
    cards.push({
      id: `${meta.setId}-${number}`,
      name: `${meta.code} #${number}`,
      english_name: null,
      set_id: meta.setId,
      set_name: meta.name,
      series: meta.series,
      release_date: meta.releaseDate,
      number,
      supertype: null,
      rarity: null,
      card_language: 'zh-cn',
      image_small: bestUrl,
      image_large: bestUrl,
    })
  }

  const byId = new Map()
  for (const card of cards) byId.set(card.id, card)
  return [...byId.values()].sort((a, b) => a.number.localeCompare(b.number))
}

function writeManifest(filePath, payload) {
  if (!filePath) return
  const absolutePath = path.resolve(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\nManifest written: ${absolutePath}`)
}

async function upsertSet(meta) {
  const row = {
    id: meta.setId,
    name: meta.name,
    series: meta.series,
    printed_total: meta.printedTotal,
    total: meta.total,
    release_date: meta.releaseDate,
  }
  const { error } = await supabase.from('tcg_sets').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`Set upsert failed ${meta.setId}: ${error.message}`)
}

async function upsertCards(cards) {
  for (let i = 0; i < cards.length; i += 250) {
    const batch = cards.slice(i, i + 250)
    const { error } = await supabase.from('tcg_cards').upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`Card upsert failed: ${error.message}`)
  }
}

console.log(`PokePop - Pokipair Simplified Chinese importer${dryRun ? ' [DRY RUN]' : ''}`)

const targets = singleSetUrl
  ? [{ href: singleSetUrl, label: singleSetUrl }]
  : extractSetLinks(await fetchHtml(INDEX_URL))

const selected = targets.slice(0, Number.isFinite(limit) ? limit : targets.length)
console.log(`Sets to inspect: ${selected.length}`)

let totalCards = 0
const manifest = {
  source: INDEX_URL,
  generated_at: new Date().toISOString(),
  note: 'Pokipair gallery pages do not expose reliable card names. Card names are placeholder set-code/number labels.',
  sets: [],
}
for (const target of selected) {
  const html = await fetchHtml(target.href)
  const meta = parseSetMeta(html, target.label, target.href)
  const cards = parseCards(html, meta)
  totalCards += cards.length
  manifest.sets.push({
    source_url: target.href,
    set: meta,
    cards,
  })

  console.log(`  ${meta.setId.padEnd(18)} ${String(cards.length).padStart(4)} cards  ${meta.name}`)

  if (!dryRun && cards.length) {
    await upsertSet(meta)
    await upsertCards(cards)
  }

  await sleep(250)
}

console.log(`\nCards found: ${totalCards}${dryRun ? ' (no writes)' : ''}`)
writeManifest(manifestPath, manifest)
if (dryRun) {
  console.log('Run with --manifest <file> to review rows, then --write --allow-placeholders to upsert placeholder Simplified Chinese card rows.')
}
