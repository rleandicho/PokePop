#!/usr/bin/env node
/**
 * PokePop – Japanese card image sourcer
 *
 * Fetches Japanese card image URLs from Bulbapedia by reading each card's
 * wiki page and extracting the jpimage field from the infobox. Downloads
 * and uploads those images to Supabase Storage, then writes the public URL
 * to tcg_cards.jp_image_small / jp_image_large.
 *
 * Works best for Japanese-exclusive sets and modern sets with distinct JP art.
 * For WotC-era sets (base1–ecard3), English and Japanese cards share the same
 * artwork — this script will record "no separate JP image" for those cards and
 * the app will fall back to the English image + language flag badge.
 *
 * Usage:
 *   node scripts/source-jp-images.mjs --set base1 [--dry-run] [--limit 10]
 *
 * The --set value is a pokemontcg.io set ID. The script reads card names and
 * numbers from the DB, queries Bulbapedia for each one, and uploads any
 * distinct JP images it finds.
 */

import fs                from 'fs'
import path              from 'path'
import { fileURLToPath } from 'url'
import { createClient }  from '@supabase/supabase-js'

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath   = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')
  for (const line of envText.split('\n')) {
    const trimmed = line.replace(/\r$/, '')
    const m = trimmed.match(/^([^#=\s]+)\s*=\s*(.+)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_SVCKEY) { console.error('ERROR: Missing Supabase credentials'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, { auth: { persistSession: false } })

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const setIdx  = args.indexOf('--set');    const setId   = setIdx  !== -1 ? args[setIdx + 1]  : null
const limIdx  = args.indexOf('--limit');  const limit   = limIdx  !== -1 ? parseInt(args[limIdx + 1]) : Infinity
const dryRun  = args.includes('--dry-run')

if (!setId) {
  console.error('Usage: node scripts/source-jp-images.mjs --set <setId> [--dry-run] [--limit N]')
  process.exit(1)
}

const BUCKET      = 'card-images'
const BULBA_API   = 'https://bulbapedia.bulbagarden.net/w/api.php'
const BULBA_ARCH  = 'https://archives.bulbagarden.net/media/upload'
const STORAGE_DIR = `jp/${setId}`

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PokePop-Bot/1.0)',
  'Referer':    'https://bulbapedia.bulbagarden.net/',
}

// ── DB set_name → Bulbapedia set name mapping ────────────────────────────────
// The TCG API stores abbreviated set names; Bulbapedia uses the full name.
const SET_NAME_MAP = {
  'Base':                    'Base Set',
  'Scarlet & Violet':        'Scarlet & Violet',   // sv1 — Bulbapedia pages sparse
  'Paldea Evolved':          'Paldea Evolved',
  'Expedition Base Set':     'Expedition',
}

function bulbaSetName(dbSetName) {
  return SET_NAME_MAP[dbSetName] ?? dbSetName
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Bulbapedia page title for a TCG card ─────────────────────────────────────
// e.g. name="Charizard", setName="Base Set", number="4" → "Charizard (Base Set 4)"
function bulbaTitle(name, setName, number) {
  return `${name} (${bulbaSetName(setName)} ${number})`
}

// ── Get the jpimage field from a card's Bulbapedia wikitext ──────────────────
// Returns the JP-specific filename only when Bulbapedia explicitly marks a card
// as having distinct Japanese artwork via the |jpimage= infobox field.
// Returns null for all other cases (page missing, no separate JP art, etc.).
async function getJpImageFilename(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse', page: pageTitle, prop: 'wikitext', format: 'json', origin: '*',
  })
  const res  = await fetch(`${BULBA_API}?${params}`, { headers: HEADERS })
  if (!res.ok) return null
  const json = await res.json()
  if (json.error) return null

  const wikitext = json.parse?.wikitext?.['*'] ?? ''

  // |jpimage= is only present when the JP version has genuinely different art.
  // If absent, EN and JP share the same artwork — return null to skip.
  const jpImgMatch = wikitext.match(/\|jpimage\s*=\s*([^\n|}\]]+)/)
  return jpImgMatch ? jpImgMatch[1].trim() : null
}

// ── Compute Bulbapedia archive URL from filename ──────────────────────────────
// Bulbapedia uses MediaWiki's path: /upload/{first}/{first+second}/{filename}
// where first = first hex char of md5(lowercase_filename)
// and   first+second = first two hex chars of md5(lowercase_filename)
async function getImageUrl(filename) {
  const params = new URLSearchParams({
    action: 'query', titles: `File:${filename}`, prop: 'imageinfo',
    iiprop: 'url', format: 'json', origin: '*',
  })
  const res  = await fetch(`${BULBA_API}?${params}`, { headers: HEADERS })
  if (!res.ok) return null
  const json = await res.json()
  const pages = Object.values(json.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.url ?? null
}

// ── Download image buffer ─────────────────────────────────────────────────────
async function downloadImage(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Upload to Supabase Storage ────────────────────────────────────────────────
async function uploadToStorage(cardId, buffer, ext) {
  const storagePath = `${STORAGE_DIR}/${cardId}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true })
  if (error) throw new Error(`Upload: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

// ── Update tcg_cards ──────────────────────────────────────────────────────────
async function updateJpImage(cardId, url) {
  const { error } = await supabase
    .from('tcg_cards')
    .update({ jp_image_small: url, jp_image_large: url })
    .eq('id', cardId)
  if (error) throw new Error(`DB: ${error.message}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`PokePop – JP Image Sourcer`)
console.log(`Set: ${setId}${dryRun ? '  [DRY RUN]' : ''}`)
console.log()

// Fetch cards from DB
const { data: cards, error: dbErr } = await supabase
  .from('tcg_cards')
  .select('id, name, number, set_name')
  .eq('set_id', setId)
  .order('number')
  .limit(limit === Infinity ? 10000 : limit)
if (dbErr) { console.error('DB error:', dbErr.message); process.exit(1) }
if (!cards?.length) { console.error('No cards found for set:', setId); process.exit(1) }

console.log(`Found ${cards.length} cards in ${setId}\n`)

let found = 0, skipped = 0, failed = 0

for (const card of cards) {
  const title = bulbaTitle(card.name, card.set_name, card.number)
  process.stdout.write(`  [${card.id}] ${title.slice(0, 45).padEnd(45)} `)

  try {
    // getJpImageFilename returns non-null ONLY when |jpimage= is explicitly set,
    // meaning Bulbapedia has confirmed the JP art differs from EN.
    const jpFilename = await getJpImageFilename(title)

    if (!jpFilename) {
      console.log('no distinct JP image')
      skipped++
      await sleep(300)
      continue
    }

    // Get the URL for this filename
    const imageUrl = await getImageUrl(jpFilename)
    if (!imageUrl) {
      console.log('no image URL')
      skipped++
      await sleep(300)
      continue
    }

    console.log(`→ ${jpFilename}`)

    if (dryRun) { found++; await sleep(300); continue }

    // Download and upload
    const buffer  = await downloadImage(imageUrl)
    const ext     = jpFilename.match(/\.png$/i) ? 'png' : 'jpg'
    const pubUrl  = await uploadToStorage(card.id, buffer, ext)
    await updateJpImage(card.id, pubUrl)
    console.log(`   ✓ uploaded: ${pubUrl.slice(0, 70)}`)
    found++
  } catch (err) {
    console.log(`✗ ${err.message}`)
    failed++
  }

  await sleep(500)  // polite rate limiting
}

console.log()
console.log(`Done:`)
console.log(`  ${found}   uploaded (distinct JP art found via Bulbapedia |jpimage= field)`)
console.log(`  ${skipped} skipped  — no Bulbapedia page or no distinct JP image`)
console.log(`  ${failed}  failed`)
if (found === 0) {
  console.log()
  console.log('Note: No distinct JP art was found for this set.')
  console.log('This is expected for WotC-era sets (identical EN/JP artwork).')
  console.log('Users can still paste custom JP image URLs in the language variant panel.')
}
