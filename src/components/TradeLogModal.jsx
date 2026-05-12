/**
 * TradeLogModal — full trade logging screen, similar to PackLogModal.
 *
 * Opens after a card trade is confirmed. Shows:
 *   • Cards Traded Away — the already-traded item + search to add more from collection
 *   • Cards Received    — real card search with image previews; selected cards are
 *                         added to the user's collection on confirm
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const CARD_BACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect width="250" height="350" fill="#1a56cc" rx="14"/><rect x="8" y="8" width="234" height="334" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" rx="10"/><circle cx="125" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="5"/><circle cx="125" cy="175" r="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="3"/><line x1="47" y1="175" x2="203" y2="175" stroke="rgba(255,255,255,0.22)" stroke-width="4"/><circle cx="125" cy="175" r="15" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.18)" stroke-width="2"/><circle cx="125" cy="175" r="9" fill="#1a56cc"/></svg>')}`

// ── Shared debounced card search hook ────────────────────────────────────────
function useCardSearch() {
  const [query,    setQuery]   = useState('')
  const [results,  setResults] = useState([])
  const [loading,  setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const words = q.split(/\s+/).filter(Boolean)
        let req = supabase
          .from('tcg_cards_with_price')
          .select('id, name, image_small, set_name, best_market_price')
        for (const word of words) {
          req = req.or(`name.ilike.%${word}%,english_name.ilike.%${word}%`)
        }
        req = req.order('release_date', { ascending: false }).limit(20)
        const { data } = await req
        setResults(data ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 340)
    return () => clearTimeout(timerRef.current)
  }, [query])

  return { query, setQuery, results, setResults, loading }
}

// ── Small card thumbnail with × remove button ─────────────────────────────────
function CardThumb({ card, onRemove, dimmed }) {
  return (
    <div className={`relative ${dimmed ? 'opacity-50' : ''}`}>
      <img
        src={card.image ?? card.image_small ?? ''}
        alt={card.name}
        className="h-16 rounded-xl shadow-md object-contain"
        onError={e => { e.currentTarget.src = CARD_BACK }}
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-400 text-white text-xs
                     flex items-center justify-center shadow hover:bg-rose-500 active:scale-95 transition"
        >×</button>
      )}
      {(card.market_price || card.best_market_price) > 0 && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white
                         bg-black/50 rounded px-1 leading-tight whitespace-nowrap">
          ${Number(card.market_price ?? card.best_market_price).toFixed(2)}
        </span>
      )}
    </div>
  )
}

// ── Search results dropdown row ────────────────────────────────────────────────
function CardResultRow({ card, onAdd }) {
  return (
    <button
      onClick={() => onAdd(card)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-pink-50 transition text-left"
    >
      <img
        src={card.image_small ?? ''}
        alt={card.name}
        className="h-10 rounded-lg flex-shrink-0 object-contain"
        onError={e => { e.currentTarget.src = CARD_BACK }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-700 truncate">{card.name}</div>
        <div className="text-xs text-gray-400">{card.set_name} · {card.id}</div>
      </div>
      {(card.best_market_price ?? 0) > 0 && (
        <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">
          ${Number(card.best_market_price).toFixed(2)}
        </span>
      )}
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function TradeLogModal({ user, tradedItem, onClose, onToast }) {
  // ── Cards traded away (already-traded item + any extras the user adds) ──
  // tradedItem is the card that was already removed from collection.
  // extraOut cards are additional cards the user selects to log as also traded out.
  const [extraOut,       setExtraOut]       = useState([])
  const outSearch = useCardSearch()

  // ── Cards received ─────────────────────────────────────────────────────────
  const [receivedCards,  setReceivedCards]  = useState([])
  const inSearch = useCardSearch()

  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  function addExtraOut(card) {
    if (extraOut.find(c => c.id === card.id)) return // no duplicates
    setExtraOut(prev => [...prev, {
      id:           card.id,
      name:         card.name,
      image:        card.image_small ?? '',
      market_price: card.best_market_price ?? 0,
      _key:         `${card.id}-${Date.now()}`,
    }])
    outSearch.setQuery('')
    outSearch.setResults([])
  }

  function removeExtraOut(key) {
    setExtraOut(prev => prev.filter(c => c._key !== key))
  }

  function addReceived(card) {
    setReceivedCards(prev => [...prev, {
      id:           card.id,
      name:         card.name,
      image:        card.image_small ?? '',
      market_price: card.best_market_price ?? 0,
      _key:         `${card.id}-${Date.now()}-${Math.random()}`,
    }])
    inSearch.setQuery('')
    inSearch.setResults([])
  }

  function removeReceived(key) {
    setReceivedCards(prev => prev.filter(c => c._key !== key))
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')

    try {
      // 1. Remove any extra "traded away" cards from collection
      for (const card of extraOut) {
        await supabase.from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', card.id)
          .eq('owned', true)
        // Also record a trade entry for each extra card given away
        await supabase.from('card_trades').insert({
          user_id:    user.id,
          card_id:    card.id,
          card_name:  card.name,
          card_image: card.image,
        })
      }

      // 2. Add received cards to collection
      if (receivedCards.length > 0) {
        const cardMap = new Map()
        for (const c of receivedCards) {
          if (!cardMap.has(c.id)) cardMap.set(c.id, { ...c, count: 0 })
          cardMap.get(c.id).count++
        }
        const cardIds = [...cardMap.keys()]
        const { data: existing } = await supabase
          .from('wishlists')
          .select('card_id, quantity, edition, language')
          .eq('user_id', user.id)
          .in('card_id', cardIds)
          .eq('owned', true)

        const existingQty = new Map()
        for (const r of existing ?? []) {
          const prev = existingQty.get(r.card_id)
          if (!prev || (r.edition === 'unspecified' && r.language === 'english')) {
            existingQty.set(r.card_id, r.quantity ?? 1)
          }
        }

        const rows = [...cardMap.values()].map(c => ({
          user_id:      user.id,
          card_id:      c.id,
          name:         c.name,
          image:        c.image,
          owned:        true,
          edition:      'unspecified',
          language:     'english',
          market_price: c.market_price || null,
          quantity:     (existingQty.get(c.id) ?? 0) + c.count,
        }))

        const { error: upsertErr } = await supabase
          .from('wishlists')
          .upsert(rows, { onConflict: 'user_id,card_id,edition,language' })

        if (upsertErr) throw upsertErr
      }

      const receivedCount = receivedCards.length
      onToast?.(receivedCount > 0
        ? `Trade logged — ${receivedCount} card${receivedCount === 1 ? '' : 's'} added to collection! 📦`
        : 'Trade logged! 🤝')
      onClose()
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-700">🤝 Log a Trade</h2>
            <p className="text-xs text-gray-400 mt-0.5">What did you swap?</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-5 pr-0.5">

          {/* ── Section 1: Cards Traded Away ────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              🔴 Cards Traded Away
            </label>

            {/* Pre-filled: the card already recorded as traded */}
            <div className="flex items-center gap-3 p-2.5 bg-rose-50 rounded-xl border border-rose-100 mb-2">
              <img
                src={tradedItem.image ?? CARD_BACK}
                alt={tradedItem.name}
                className="h-12 rounded-lg flex-shrink-0"
                onError={e => { e.currentTarget.src = CARD_BACK }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 truncate">{tradedItem.name}</p>
                <p className="text-[11px] text-rose-400 font-medium">Already recorded as traded</p>
              </div>
            </div>

            {/* Search for additional cards traded out */}
            <div className="relative">
              <input
                type="text"
                value={outSearch.query}
                onChange={e => outSearch.setQuery(e.target.value)}
                placeholder="Search more cards you gave away…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-300"
              />
              {outSearch.loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">searching…</span>
              )}
            </div>

            {outSearch.results.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden max-h-40 overflow-y-auto shadow-md">
                {outSearch.results.map(card => (
                  <CardResultRow key={card.id} card={card} onAdd={addExtraOut} />
                ))}
              </div>
            )}

            {extraOut.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {extraOut.map(c => (
                  <CardThumb key={c._key} card={c} onRemove={() => removeExtraOut(c._key)} />
                ))}
              </div>
            )}
          </div>

          {/* Divider arrow */}
          <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
            <div className="flex-1 border-t border-gray-100" />
            <span>↕ in exchange for</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          {/* ── Section 2: Cards Received ────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              🟢 Cards Received
            </label>

            <div className="relative">
              <input
                type="text"
                value={inSearch.query}
                onChange={e => inSearch.setQuery(e.target.value)}
                placeholder="Search a card you received…"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-300"
              />
              {inSearch.loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">searching…</span>
              )}
            </div>

            {inSearch.results.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-md">
                {inSearch.results.map(card => (
                  <CardResultRow key={card.id} card={card} onAdd={addReceived} />
                ))}
              </div>
            )}

            {receivedCards.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Received ({receivedCards.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {receivedCards.map(c => (
                    <CardThumb key={c._key} card={c} onRemove={() => removeReceived(c._key)} />
                  ))}
                </div>
              </div>
            )}

            {receivedCards.length === 0 && !inSearch.query && (
              <p className="text-xs text-gray-400 mt-2">Search above to add cards you received.</p>
            )}
          </div>

        </div>

        {/* Summary */}
        {(extraOut.length > 0 || receivedCards.length > 0) && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
            <span>
              Gave away: <strong className="text-rose-500">{1 + extraOut.length} card{1 + extraOut.length === 1 ? '' : 's'}</strong>
            </span>
            {receivedCards.length > 0 && (
              <span>
                Received: <strong className="text-emerald-600">{receivedCards.length} card{receivedCards.length === 1 ? '' : 's'}</strong>
              </span>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
          >Skip</button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-sky-400 hover:bg-sky-500 text-white transition disabled:opacity-60"
          >{saving ? 'Saving…' : receivedCards.length > 0 ? `Add ${receivedCards.length} to Collection →` : 'Confirm Trade'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
