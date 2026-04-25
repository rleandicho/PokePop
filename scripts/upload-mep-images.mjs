#!/usr/bin/env node
/**
 * PokePop – One-time MEP promo image upload script
 *
 * Downloads MEP-37 through MEP-45 card images from Bulbapedia archives
 * (server-side fetch bypasses hotlink protection) and uploads them to
 * Supabase Storage, then updates the tcg_cards table with the new URLs.
 *
 * Usage:
 *   npm run upload-mep-images
 *   node scripts/upload-mep-images.mjs
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

const SUPABASE_URL    = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPABASE_SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SVCKEY) {
  console.error('ERROR: Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SVCKEY, {
  auth: { persistSession: false }
})

// ── Card definitions ──────────────────────────────────────────────────────────
const CARDS = [
  { id: 'mep-37', name: 'Bulbasaur',  hash: '3/32/BulbasaurMEPPromo37.jpg'  },
  { id: 'mep-38', name: 'Charmander', hash: 'b/b3/CharmanderMEPPromo38.jpg' },
  { id: 'mep-39', name: 'Squirtle',   hash: 'e/e9/SquirtleMEPPromo39.jpg'   },
  { id: 'mep-40', name: 'Turtwig',    hash: 'b/ba/TurtwigMEPPromo40.jpg'    },
  { id: 'mep-41', name: 'Chimchar',   hash: 'd/de/ChimcharMEPPromo41.jpg'   },
  { id: 'mep-42', name: 'Piplup',     hash: '5/5f/PiplupMEPPromo42.jpg'     },
  { id: 'mep-43', name: 'Rowlet',     hash: '5/5b/RowletMEPPromo43.jpg'     },
  { id: 'mep-44', name: 'Litten',     hash: '9/92/LittenMEPPromo44.jpg'     },
  { id: 'mep-45', name: 'Popplio',    hash: '9/9c/PopplioMEPPromo45.jpg'    },
]

const BUCKET      = 'card-images'
const BULBA_BASE  = 'https://archives.bulbagarden.net/media/upload'

// ── Helpers ───────────────────────────────────────────────────────────────────
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.find(b => b.name === BUCKET)) return

  const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error(`Failed to create bucket: ${error.message}`)
  console.log(`Created storage bucket: ${BUCKET}`)
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      // Mimic a regular browser request to pass through the CDN
      'User-Agent': 'Mozilla/5.0 (compatible; PokePop-Bot/1.0)',
      'Referer':    'https://bulbapedia.bulbagarden.net/',
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadToStorage(card, imageBuffer) {
  const storagePath = `mep/${card.id}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType:  'image/jpeg',
      upsert:       true,
    })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

async function updateCardImages(cardId, imageUrl) {
  const { error } = await supabase
    .from('tcg_cards')
    .update({ image_small: imageUrl, image_large: imageUrl })
    .eq('id', cardId)
  if (error) throw new Error(`DB update failed: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('PokePop – MEP Image Uploader')
console.log(`Supabase URL: ${SUPABASE_URL}`)
console.log()

await ensureBucket()

let success = 0
let failed  = 0

for (const card of CARDS) {
  const bulbaUrl = `${BULBA_BASE}/${card.hash}`
  process.stdout.write(`  ${card.id} ${card.name}… `)

  try {
    const buffer    = await downloadImage(bulbaUrl)
    const publicUrl = await uploadToStorage(card, buffer)
    await updateCardImages(card.id, publicUrl)
    console.log(`✓ ${publicUrl}`)
    success++
  } catch (err) {
    console.log(`✗ ${err.message}`)
    failed++
  }

  // Brief pause to be polite to Bulbagarden servers
  await new Promise(r => setTimeout(r, 500))
}

console.log()
console.log(`Done: ${success} uploaded, ${failed} failed.`)
if (failed > 0) console.log('Re-run to retry failed cards.')
