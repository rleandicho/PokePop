/**
 * verify-card-images.mjs
 *
 * Safeguard script — checks that card image URLs actually serve valid image
 * content (non-tiny JPEG/PNG). Run before and after any image-URL fix to catch
 * wrong-hash or broken-URL issues early.
 *
 * Usage:
 *   node scripts/verify-card-images.mjs mep-46 mep-47 mep-52 mep-54
 *   node scripts/verify-card-images.mjs --set mep
 *   node scripts/verify-card-images.mjs --set zh-CBB3
 *
 * Exit code 1 if any card fails verification (useful in CI).
 */
import { createClient } from '@supabase/supabase-js'
import { config }       from 'dotenv'
import https            from 'https'
import http             from 'http'

config()

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/** Minimum acceptable image size in bytes — images below this are likely wrong-hash/placeholder */
const MIN_BYTES = 20_000

/** Returns { ok, bytes, error } for a URL, simulating a browser Referer to catch hotlink-blocked URLs */
function checkUrl(url) {
  return new Promise(resolve => {
    if (!url) return resolve({ ok: false, bytes: 0, error: 'no URL' })
    const lib = url.startsWith('https') ? https : http
    const req = lib.request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://pokepop.vercel.app',
      }
    }, res => {
      const size = parseInt(res.headers['content-length'] ?? '0', 10)
      const type = res.headers['content-type'] ?? ''
      if (res.statusCode !== 200) return resolve({ ok: false, bytes: size, error: `HTTP ${res.statusCode} (hotlink blocked?)` })
      if (!type.startsWith('image/')) return resolve({ ok: false, bytes: size, error: `Wrong content-type: ${type}` })
      if (size < MIN_BYTES) return resolve({ ok: false, bytes: size, error: `Too small (${size}B < ${MIN_BYTES}B — likely wrong hash)` })
      resolve({ ok: true, bytes: size, error: null })
    })
    req.on('error', e => resolve({ ok: false, bytes: 0, error: e.message }))
    req.end()
  })
}

async function main() {
  const args = process.argv.slice(2)

  let cardIds = []

  if (args[0] === '--set') {
    const setId = args[1]
    if (!setId) { console.error('Usage: --set <set-id>'); process.exit(1) }
    const { data } = await sb
      .from('tcg_cards')
      .select('id, name, image_small')
      .eq('set_id', setId)
      .order('number')
    cardIds = (data ?? []).map(r => r.id)
    console.log(`Verifying ${cardIds.length} cards in set ${setId}\n`)
  } else if (args.length > 0) {
    cardIds = args
  } else {
    console.error('Usage: node verify-card-images.mjs <card-id> ...')
    console.error('       node verify-card-images.mjs --set <set-id>')
    process.exit(1)
  }

  const { data: cards, error } = await sb
    .from('tcg_cards')
    .select('id, name, number, image_small, image_large')
    .in('id', cardIds)

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  let failed = 0

  for (const card of (cards ?? [])) {
    const { ok, bytes, error: e } = await checkUrl(card.image_small)
    const icon = ok ? '✓' : '✗'
    const detail = ok ? `${(bytes/1024).toFixed(0)}KB` : e
    console.log(`${icon} ${card.id.padEnd(20)} ${(card.name ?? '').padEnd(25)} ${detail}`)
    if (!ok) failed++
  }

  console.log(`\n${cards.length - failed}/${cards.length} passed`)
  if (failed > 0) {
    console.log(`\n⚠  ${failed} card(s) failed — fix their image URLs before committing.`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
