/**
 * PokePop – Weekly Price Refresh Edge Function
 *
 * Runs on a schedule (set via pg_cron below) to keep card prices fresh.
 * Processes cards in priority order:
 *   1. Cards with no price at all
 *   2. Cards whose price is > 7 days old
 *
 * Fetches from pokemontcg.io (TCGPlayer prices).
 * Falls back to eBay Finding API for cards with no TCGPlayer listing.
 *
 * Schedule setup — run this SQL once in Supabase SQL Editor:
 *
 *   SELECT cron.schedule(
 *     'weekly-price-refresh',
 *     '0 2 * * 0',   -- every Sunday at 02:00 UTC
 *     $$
 *       SELECT net.http_post(
 *         url  := '<YOUR_SUPABASE_PROJECT_URL>/functions/v1/weekly-price-refresh',
 *         headers := '{"Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>"}'::jsonb
 *       );
 *     $$
 *   );
 *
 * Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL            — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   TCG_API_KEY             — pokemontcg.io API key
 *   EBAY_APP_ID             — eBay Finding API App ID (optional)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TCG_API_KEY      = Deno.env.get('TCG_API_KEY') ?? ''
const EBAY_APP_ID      = Deno.env.get('EBAY_APP_ID') ?? ''

// Process at most this many cards per run to avoid Edge Function timeouts (400 s limit)
const MAX_CARDS_PER_RUN = 2000
const PRICE_TTL_DAYS    = 7
const TCG_BATCH         = 100   // IDs per pokemontcg.io request

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { persistSession: false }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parseTcgPrices(prices: Record<string, unknown> | undefined, cardId: string) {
  const p = prices ?? {}
  const KNOWN = new Set(['normal','holofoil','reverseHolofoil','1stEditionHolofoil','1stEditionNormal'])
  const otherEntry = Object.entries(p).find(([k, v]) =>
    !KNOWN.has(k) && (v as { market?: number })?.market != null
  )
  const other = otherEntry ? otherEntry[1] as { market?: number; mid?: number; low?: number } : null

  return {
    card_id:                cardId,
    normal_market:          (p.normal as { market?: number })?.market          ?? null,
    normal_mid:             (p.normal as { mid?: number })?.mid               ?? null,
    normal_low:             (p.normal as { low?: number })?.low               ?? null,
    holofoil_market:        (p.holofoil as { market?: number })?.market       ?? null,
    holofoil_mid:           (p.holofoil as { mid?: number })?.mid             ?? null,
    holofoil_low:           (p.holofoil as { low?: number })?.low             ?? null,
    reverse_holo_market:    (p.reverseHolofoil as { market?: number })?.market ?? null,
    reverse_holo_mid:       (p.reverseHolofoil as { mid?: number })?.mid      ?? null,
    reverse_holo_low:       (p.reverseHolofoil as { low?: number })?.low      ?? null,
    first_ed_holo_market:   (p['1stEditionHolofoil'] as { market?: number })?.market ?? null,
    first_ed_normal_market: (p['1stEditionNormal'] as { market?: number })?.market   ?? null,
    other_market:           other?.market ?? null,
    other_mid:              other?.mid    ?? null,
    other_low:              other?.low    ?? null,
    updated_at:             new Date().toISOString(),
  }
}

function hasPriceData(row: ReturnType<typeof parseTcgPrices>) {
  return [row.normal_market, row.holofoil_market, row.reverse_holo_market,
          row.first_ed_holo_market, row.first_ed_normal_market, row.other_market
  ].some(v => v != null)
}

// ── Get stale card IDs from our DB ────────────────────────────────────────────
async function getStaleCards(): Promise<{ id: string; name: string; set_name: string }[]> {
  const cutoff = new Date(Date.now() - PRICE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Cards with no price row at all
  const { data: allCards } = await supabase
    .from('tcg_cards')
    .select('id, name, set_name')
    .limit(MAX_CARDS_PER_RUN)

  const { data: recentPrices } = await supabase
    .from('tcg_prices')
    .select('card_id')
    .gte('updated_at', cutoff)

  const freshSet = new Set((recentPrices ?? []).map((r: { card_id: string }) => r.card_id))
  return (allCards ?? []).filter(c => !freshSet.has(c.id))
}

// ── Fetch TCGPlayer prices from pokemontcg.io ─────────────────────────────────
async function fetchTcgPrices(cards: { id: string }[]) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (TCG_API_KEY) headers['X-Api-Key'] = TCG_API_KEY

  const results: Record<string, ReturnType<typeof parseTcgPrices>> = {}

  for (const batch of chunk(cards.map(c => c.id), TCG_BATCH)) {
    const q = batch.map(id => `id:${id}`).join(' OR ')
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&select=id,tcgplayer&pageSize=${TCG_BATCH}`

    try {
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const { data: apiCards } = await res.json()
      for (const card of (apiCards ?? [])) {
        const row = parseTcgPrices(card.tcgplayer?.prices, card.id)
        if (hasPriceData(row)) results[card.id] = row
      }
    } catch { /* skip batch on network error */ }

    // Respectful rate limiting
    await new Promise(r => setTimeout(r, TCG_API_KEY ? 40 : 1100))
  }

  return results
}

// ── eBay fallback ─────────────────────────────────────────────────────────────
async function fetchEbayAvg(cardName: string, setName: string): Promise<number | null> {
  if (!EBAY_APP_ID) return null
  const keywords = encodeURIComponent(`pokemon ${cardName} ${setName} card`)
  const url = [
    'https://svcs.ebay.com/services/search/FindingService/v1',
    '?OPERATION-NAME=findCompletedItems',
    '&SERVICE-VERSION=1.0.0',
    `&SECURITY-APPNAME=${EBAY_APP_ID}`,
    '&RESPONSE-DATA-FORMAT=JSON',
    `&keywords=${keywords}`,
    '&categoryId=183454',
    '&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true',
    '&itemFilter(1).name=Condition&itemFilter(1).value=3000',
    '&sortOrder=EndTimeSoonest',
    '&paginationInput.entriesPerPage=10',
  ].join('')

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const items = json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
    const prices = (items as { sellingStatus?: [{ currentPrice?: [{ __value__: string }] }] }[])
      .map(i => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? '0'))
      .filter(p => p > 0)
    return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  } catch { return null }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  const started = Date.now()

  try {
    const staleCards = await getStaleCards()
    if (!staleCards.length) {
      return new Response(JSON.stringify({ ok: true, message: 'All prices up to date.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tcgMap = await fetchTcgPrices(staleCards)

    // eBay fallback for cards still missing prices
    let ebayFilled = 0
    for (const card of staleCards) {
      if (tcgMap[card.id]) continue
      const avg = await fetchEbayAvg(card.name, card.set_name)
      if (avg != null) {
        tcgMap[card.id] = {
          card_id: card.id,
          normal_market: null, normal_mid: null, normal_low: null,
          holofoil_market: null, holofoil_mid: null, holofoil_low: null,
          reverse_holo_market: null, reverse_holo_mid: null, reverse_holo_low: null,
          first_ed_holo_market: null, first_ed_normal_market: null,
          other_market: parseFloat(avg.toFixed(2)),
          other_mid: null, other_low: null,
          updated_at: new Date().toISOString(),
        }
        ebayFilled++
      }
      await new Promise(r => setTimeout(r, 250))
    }

    // Upsert all price rows
    const priceRows = Object.values(tcgMap)
    for (const batch of chunk(priceRows, 500)) {
      await supabase.from('tcg_prices').upsert(batch, { onConflict: 'card_id' })
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    return new Response(JSON.stringify({
      ok: true,
      stale_cards: staleCards.length,
      tcg_updated: Object.keys(tcgMap).length - ebayFilled,
      ebay_filled: ebayFilled,
      elapsed_s: elapsed,
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
