import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const CARD_BACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect width="250" height="350" fill="#1a56cc" rx="14"/><rect x="8" y="8" width="234" height="334" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" rx="10"/><circle cx="125" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="5"/><circle cx="125" cy="175" r="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="3"/><line x1="47" y1="175" x2="203" y2="175" stroke="rgba(255,255,255,0.22)" stroke-width="4"/><circle cx="125" cy="175" r="15" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.18)" stroke-width="2"/><circle cx="125" cy="175" r="9" fill="#1a56cc"/></svg>')}`

const SETS_CACHE_KEY = 'pokepop_sets_v2'
const SETS_TTL       = 24 * 60 * 60 * 1000

const PURCHASE_TYPES = [
  'Booster Pack', 'Blister Pack', 'Booster Bundle', 'ETB',
  'Mini-Tin', 'Tin', 'Pokeball Tin', 'Collection Box', 'Pre-release Kit', 'Promo Pack',
]

async function loadSets() {
  try {
    const cached = localStorage.getItem(SETS_CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < SETS_TTL && Array.isArray(data)) return data
    }

    // Fetch from both pokemontcg.io and Supabase in parallel so ME-series sets appear
    const [apiSets, supabaseSets] = await Promise.all([
      (async () => {
        try {
          const apiKey  = import.meta.env.VITE_TCG_API_KEY
          const headers = apiKey ? { 'X-Api-Key': apiKey } : {}
          const res  = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate', { headers })
          const json = await res.json()
          return json.data ?? []
        } catch { return [] }
      })(),
      (async () => {
        try {
          const { data } = await supabase
            .from('tcg_sets')
            .select('id, name, series, release_date')
            .order('release_date', { ascending: false })
          return (data ?? []).map(s => ({ id: s.id, name: s.name, series: s.series, releaseDate: s.release_date }))
        } catch { return [] }
      })(),
    ])

    // Merge: Supabase sets first (newer/custom), deduplicate by id
    const seenIds = new Set()
    const sets = [...supabaseSets, ...apiSets].filter(s => {
      if (seenIds.has(s.id)) return false
      seenIds.add(s.id)
      return true
    })

    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify({ data: sets, ts: Date.now() }))
    return sets
  } catch {
    return []
  }
}

function blankRow() {
  return { _id: `${Date.now()}-${Math.random()}`, name: '', setId: null, qty: 1 }
}

// ── Single pack name row — name input + qty stepper + set autocomplete ────────
// memo: skips re-render if props haven't changed (prevents re-renders from
// purchaseType / price / store state changes in the parent modal).
const PackNameRow = memo(function PackNameRow({ row, index, total, allSets, onUpdate, onRemove }) {
  const [showSugg, setShowSugg] = useState(false)
  const [sugg,     setSugg]     = useState([])

  function handleChange(val) {
    onUpdate({ name: val, setId: null })
    const q = val.trim().toLowerCase()
    if (!q || !allSets.length) { setSugg([]); setShowSugg(false); return }
    const matches = allSets
      .filter(s => s.name.toLowerCase().includes(q) || s.series?.toLowerCase().includes(q))
      .slice(0, 6)
    setSugg(matches)
    setShowSugg(matches.length > 0)
  }

  function pickSet(set) {
    onUpdate({ name: set.name, setId: set.id })
    setSugg([])
    setShowSugg(false)
  }

  const qty = row.qty ?? 1

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {/* Set name autocomplete */}
        <div className="relative flex-1">
          <input
            type="text"
            value={row.name}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => sugg.length && setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            placeholder={index === 0 ? 'Set name (e.g. Stellar Crown…)' : 'Another set…'}
            autoFocus={index === 0}
            autoComplete="off"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
          />
          {showSugg && sugg.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
              {sugg.map(s => (
                <button
                  key={s.id}
                  onMouseDown={() => pickSet(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-pink-50 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.series} · {s.releaseDate?.slice(0, 4)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pack quantity stepper */}
        <div className="flex items-center gap-0.5 flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdate({ qty: Math.max(1, qty - 1) })}
            className="w-6 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-sm leading-none transition"
          >−</button>
          <span className="w-6 text-center text-xs font-semibold text-gray-600 tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => onUpdate({ qty: qty + 1 })}
            className="w-6 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-sm leading-none transition"
          >+</button>
        </div>

        {/* Remove row — only when there are multiple rows */}
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                       text-gray-300 hover:text-rose-400 hover:bg-rose-50 transition"
            title="Remove this pack"
          >×</button>
        )}
      </div>

      {/* Set-selected confirmation */}
      {row.setId && (
        <p className="text-[11px] text-emerald-600 font-medium mt-0.5 pl-1">✓ Set locked in</p>
      )}
    </div>
  )
})

export default function PackLogModal({ user, onClose, onSaved, onCardsSaved }) {
  const [purchaseType,  setPurchaseType]  = useState('Booster Pack')
  const [packRows,      setPackRows]      = useState([blankRow()])
  const [packPrice,     setPackPrice]     = useState('')
  const [priceMode,     setPriceMode]     = useState('per-item') // 'per-item' | 'total'
  const [store,         setStore]         = useState('')
  const [cardSearch,    setCardSearch]    = useState('')
  const [cardResults,   setCardResults]   = useState([])
  const [searching,     setSearching]     = useState(false)
  const [addedCards,    setAddedCards]    = useState([])
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [allSets,       setAllSets]       = useState([])
  const [recentStores,  setRecentStores]  = useState([]) // autofill suggestions
  const [lastPrice,     setLastPrice]     = useState(null) // last used price hint
  const [showStoreSugg, setShowStoreSugg] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadSets().then(setAllSets) }, [])

  // Load recent stores + last price from pack_logs for autofill
  useEffect(() => {
    if (!user) return
    supabase
      .from('pack_logs')
      .select('store, pack_price')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data) return
        const stores = [...new Set(data.map(r => r.store).filter(Boolean))].slice(0, 8)
        setRecentStores(stores)
        const lastUsedPrice = data.find(r => r.pack_price > 0)?.pack_price
        if (lastUsedPrice) setLastPrice(lastUsedPrice)
      })
  }, [user])

  // Deduplicated set IDs — prevents duplicate .in() entries and unstable dep strings
  const activeSetIds   = [...new Set(packRows.filter(r => r.setId).map(r => r.setId))]
  const activeSetNames = [...new Set(packRows.filter(r => r.setId && r.name).map(r => r.name))]

  // ── Pack row management ───────────────────────────────────────────────────
  // useCallback keeps references stable so memo'd PackNameRows don't re-render
  // when unrelated state (purchaseType, price, store) changes.
  const updateRow = useCallback((id, changes) => {
    setPackRows(prev => prev.map(r => r._id === id ? { ...r, ...changes } : r))
  }, [])
  const addRow = useCallback(() => {
    setPackRows(prev => [...prev, blankRow()])
  }, [])
  const removeRow = useCallback((id) => {
    setPackRows(prev => prev.filter(r => r._id !== id))
  }, [])

  // ── Card search — Supabase query, OR across all selected sets ───────────────
  useEffect(() => {
    if (!cardSearch.trim()) { setCardResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        let q = supabase
          .from('tcg_cards_with_price')
          .select('id, name, image_small, set_id, set_name, best_market_price')

        // Name filter — AND across words for precision
        const words = cardSearch.trim().split(/\s+/).filter(Boolean)
        for (const word of words) {
          q = q.or(`name.ilike.%${word}%,english_name.ilike.%${word}%`)
        }

        // Set filter — include selected sets OR any Promo card (promo variants often ship with boxes)
        if (activeSetIds.length > 0) {
          const setClause = activeSetIds.length === 1
            ? `set_id.eq.${activeSetIds[0]}`
            : `set_id.in.(${activeSetIds.join(',')})`
          q = q.or(`${setClause},subtypes.cs.{"Promo"}`)
        }

        q = q.order('release_date', { ascending: false }).limit(20)
        const { data } = await q
        setCardResults(data ?? [])
      } catch {
        setCardResults([])
      } finally {
        setSearching(false)
      }
    }, 380)
    return () => clearTimeout(debounceRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSearch, activeSetIds.join(',')])

  function addCard(card) {
    setAddedCards(prev => [...prev, {
      id:           card.id,
      name:         card.name,
      image:        card.image_small ?? '',
      market_price: card.best_market_price ?? 0,
      _key:         `${card.id}-${Date.now()}-${Math.random()}`,
    }])
    setCardSearch('')
    setCardResults([])
  }

  function removeCard(key) {
    setAddedCards(prev => {
      const idx = prev.findIndex(c => c._key === key)
      if (idx === -1) return prev
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }

  const totalValue = addedCards.reduce((s, c) => s + (c.market_price || 0), 0)

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const filledRows = packRows.filter(r => r.name.trim())
    if (!filledRows.length) { setError('Enter at least one set or pack name.'); return }
    const price = finalPrice
    setSaving(true)
    setError('')

    if (addedCards.length > 0) {
      const cardMap = new Map()
      for (const c of addedCards) {
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
      // Build qty map: prefer the 'unspecified'/'english' row; fall back to any owned row
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
      if (upsertErr) { setSaving(false); setError('Failed to save cards. Please try again.'); return }
      onCardsSaved?.([...cardMap.values()])
    }

    const packsPayload = filledRows.map(r => ({ name: r.name.trim(), type: purchaseType, qty: r.qty ?? 1 }))

    const { data, error: insertErr } = await supabase
      .from('pack_logs')
      .insert({
        user_id:     user.id,
        pack_name:   packsPayload.map(p => p.qty > 1 ? `${p.name} ×${p.qty}` : p.name).join(' + '),
        pack_type:   purchaseType,
        pack_price:  price,
        total_value: totalValue,
        store:       store.trim() || null,
        cards:       addedCards.map(c => ({ id: c.id, name: c.name, image: c.image, market_price: c.market_price })),
        packs:       packsPayload,
      })
      .select()
      .single()

    setSaving(false)
    if (insertErr) { setError('Failed to save. Please try again.'); return }
    onSaved(data)
    onClose()
  }

  const totalPacks   = packRows.reduce((sum, r) => sum + (r.qty ?? 1), 0)
  const countLabel   = totalPacks === 1 ? '1 pack' : `${totalPacks} packs`
  const perItemPrice = parseFloat(packPrice) || 0
  const finalPrice   = priceMode === 'per-item' ? perItemPrice * totalPacks : perItemPrice

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
            <h2 className="text-lg font-bold text-gray-700">🎴 Log a Pack</h2>
            {packRows.length > 1 && (
              <p className="text-xs text-violet-500 font-semibold mt-0.5">{countLabel} in this purchase</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-0.5">

          {/* ── 1. Purchase type ────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Purchase Type</label>
            <div className="flex flex-wrap gap-1.5">
              {PURCHASE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPurchaseType(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition
                    ${purchaseType === t
                      ? 'bg-pink-400 border-pink-400 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Pack name rows ───────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Sets / Packs
              <span className="ml-1 font-normal text-gray-400">— one per pack in your purchase</span>
            </label>
            <div className="space-y-2">
              {packRows.map((row, i) => (
                <PackNameRow
                  key={row._id}
                  row={row}
                  index={i}
                  total={packRows.length}
                  allSets={allSets}
                  onUpdate={changes => updateRow(row._id, changes)}
                  onRemove={() => removeRow(row._id)}
                />
              ))}
            </div>

            {/* Add another pack button */}
            <button
              type="button"
              onClick={addRow}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-pink-400
                         hover:text-pink-500 transition"
            >
              <span className="w-5 h-5 rounded-full border-2 border-pink-300 flex items-center justify-center
                               text-pink-400 font-bold leading-none">+</span>
              Add another pack
            </button>
          </div>

          {/* ── 3. Price + Store ─────────────────────────────────────────── */}
          <div className="flex gap-3">
            <div className="flex-1">
              {/* Price mode toggle */}
              <div className="flex items-center gap-1 mb-1">
                <button
                  type="button"
                  onClick={() => setPriceMode('per-item')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition
                    ${priceMode === 'per-item'
                      ? 'bg-pink-400 border-pink-400 text-white'
                      : 'border-gray-200 text-gray-400 hover:border-pink-300'}`}
                >Per pack</button>
                <button
                  type="button"
                  onClick={() => setPriceMode('total')}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition
                    ${priceMode === 'total'
                      ? 'bg-pink-400 border-pink-400 text-white'
                      : 'border-gray-200 text-gray-400 hover:border-pink-300'}`}
                >Total</button>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packPrice}
                onChange={e => setPackPrice(e.target.value)}
                placeholder={priceMode === 'per-item' ? 'Price per pack…' : 'Total paid…'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              />
              {/* Per-item auto-total preview */}
              {priceMode === 'per-item' && perItemPrice > 0 && totalPacks > 1 && (
                <p className="mt-0.5 text-[11px] text-violet-500 font-medium">
                  ${perItemPrice.toFixed(2)} × {totalPacks} = <strong>${finalPrice.toFixed(2)}</strong> total
                </p>
              )}
              {lastPrice != null && !packPrice && (
                <button
                  type="button"
                  onClick={() => setPackPrice(String(lastPrice))}
                  className="mt-0.5 text-[11px] text-pink-400 hover:text-pink-500 font-medium"
                >
                  Use last: ${Number(lastPrice).toFixed(2)}
                </button>
              )}
            </div>
            <div className="flex-1 relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Store (optional)</label>
              <input
                type="text"
                value={store}
                onChange={e => { setStore(e.target.value); setShowStoreSugg(true) }}
                onFocus={() => setShowStoreSugg(true)}
                onBlur={() => setTimeout(() => setShowStoreSugg(false), 150)}
                placeholder="Target, eBay…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              />
              {showStoreSugg && recentStores.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                  {recentStores
                    .filter(s => !store || s.toLowerCase().includes(store.toLowerCase()))
                    .map(s => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => { setStore(s); setShowStoreSugg(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-pink-50 transition"
                      >
                        📍 {s}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 4. Card search ───────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Add Cards Pulled</label>

            {/* Active set filter indicator — updates as user picks sets above */}
            {activeSetNames.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mb-2">
                <span>🎯</span>
                <span className="flex-1 min-w-0 truncate">
                  Searching in: <strong>{activeSetNames.join(' + ')}</strong>
                </span>
                <button
                  onClick={() => setPackRows(prev => prev.map(r => ({ ...r, setId: null })))}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
                  title="Search all sets"
                >✕</button>
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                value={cardSearch}
                onChange={e => setCardSearch(e.target.value)}
                placeholder={
                  activeSetNames.length > 0
                    ? `Search in ${activeSetNames.length > 1 ? `${activeSetNames.length} sets` : activeSetNames[0]}…`
                    : 'Search Pokémon card name…'
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">searching…</span>
              )}
            </div>

            {cardResults.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-md">
                {cardResults.map(card => (
                  <button
                    key={card.id}
                    onClick={() => addCard(card)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-pink-50 transition text-left"
                  >
                    <img
                      src={card.image_small}
                      alt={card.name}
                      className="h-10 rounded-lg flex-shrink-0"
                      onError={e => { e.currentTarget.src = CARD_BACK }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{card.name}</div>
                      <div className="text-xs text-gray-400">{card.set_name} · {card.id}</div>
                    </div>
                    {(card.best_market_price ?? 0) > 0 && (
                      <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">${card.best_market_price.toFixed(2)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. Cards pulled ─────────────────────────────────────────── */}
          {addedCards.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">Cards pulled ({addedCards.length})</div>
              <div className="flex flex-wrap gap-2">
                {addedCards.map(c => (
                  <div key={c._key} className="relative">
                    <img
                      src={c.image}
                      alt={c.name}
                      className="h-16 rounded-xl shadow-md"
                      onError={e => { e.currentTarget.src = CARD_BACK }}
                    />
                    <button
                      onClick={() => removeCard(c._key)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-400 text-white text-xs
                                 flex items-center justify-center shadow transition hover:bg-rose-500 active:scale-95"
                      title="Remove this card"
                    >×</button>
                    {c.market_price > 0 && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white
                                       bg-black/50 rounded px-1 leading-tight">
                        ${c.market_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Value summary */}
        <div className="mt-4 flex items-center justify-between text-sm border-t border-gray-100 pt-3">
          <span className="text-gray-500">
            Paid: <strong className="text-rose-500">${finalPrice.toFixed(2)}</strong>
          </span>
          {totalValue > 0 && (
            <span className="text-gray-500">
              Worth: <strong className="text-emerald-600">${totalValue.toFixed(2)}</strong>
            </span>
          )}
        </div>

        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-pink-400 to-violet-400
                       text-white hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : `Save ${countLabel}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
