import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const CARD_BACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect width="250" height="350" fill="#1a56cc" rx="14"/><rect x="8" y="8" width="234" height="334" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" rx="10"/><circle cx="125" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="5"/><circle cx="125" cy="175" r="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="3"/><line x1="47" y1="175" x2="203" y2="175" stroke="rgba(255,255,255,0.22)" stroke-width="4"/><circle cx="125" cy="175" r="15" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.18)" stroke-width="2"/><circle cx="125" cy="175" r="9" fill="#1a56cc"/></svg>')}`

// ── Cached set list (reuse AestheticFilter's localStorage cache key)
const SETS_CACHE_KEY = 'pokepop_sets_v1'
const SETS_TTL       = 24 * 60 * 60 * 1000

async function loadSets() {
  try {
    const cached = localStorage.getItem(SETS_CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < SETS_TTL && Array.isArray(data)) return data
    }
    const apiKey  = import.meta.env.VITE_TCG_API_KEY
    const headers = apiKey ? { 'X-Api-Key': apiKey } : {}
    const res     = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate', { headers })
    const json    = await res.json()
    const sets    = json.data ?? []
    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify({ data: sets, ts: Date.now() }))
    return sets
  } catch {
    return []
  }
}

export default function PackLogModal({ user, onClose, onSaved }) {
  const [packName,     setPackName]     = useState('')
  const [packPrice,    setPackPrice]    = useState('')
  const [store,        setStore]        = useState('')
  const [cardSearch,   setCardSearch]   = useState('')
  const [cardResults,  setCardResults]  = useState([])
  const [searching,    setSearching]    = useState(false)
  const [addedCards,   setAddedCards]   = useState([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  // Set name suggestions + selected set
  const [allSets,        setAllSets]        = useState([])
  const [setSuggestions, setSetSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSetId,  setSelectedSetId]  = useState(null) // restrict card search to this set
  const nameRef    = useRef(null)
  const debounceRef = useRef(null)

  // Load set list on mount
  useEffect(() => {
    loadSets().then(sets => setAllSets(sets))
  }, [])

  // Filter set suggestions as user types
  useEffect(() => {
    const q = packName.trim().toLowerCase()
    if (!q || allSets.length === 0) { setSetSuggestions([]); return }
    const matches = allSets
      .filter(s => s.name.toLowerCase().includes(q) || s.series?.toLowerCase().includes(q))
      .slice(0, 6)
    setSetSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [packName, allSets])

  function pickSet(set) {
    setPackName(set.name)
    setSelectedSetId(set.id)
    setShowSuggestions(false)
    setCardSearch('')
    setCardResults([])
  }

  // Clear set restriction if user edits the pack name manually
  function handlePackNameChange(val) {
    setPackName(val)
    setSelectedSetId(null) // clear set filter until they pick from suggestions again
    setShowSuggestions(true)
  }

  // Search cards via TCG API — restricted to selected set if available
  useEffect(() => {
    if (!cardSearch.trim()) { setCardResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const apiKey = import.meta.env.VITE_TCG_API_KEY
        const headers = apiKey ? { 'X-Api-Key': apiKey } : {}
        const parts = [`name:*${cardSearch.trim()}*`]
        if (selectedSetId) parts.push(`set.id:${selectedSetId}`)
        const q = encodeURIComponent(parts.join(' '))
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=12&select=id,name,images,tcgplayer`, { headers })
        const json = await res.json()
        setCardResults(json.data ?? [])
      } catch {
        setCardResults([])
      } finally {
        setSearching(false)
      }
    }, 380)
    return () => clearTimeout(debounceRef.current)
  }, [cardSearch])

  function getBestPrice(card) {
    const prices = card.tcgplayer?.prices ?? {}
    const tiers  = ['holofoil', 'reverseHolofoil', 'normal', 'unlimited']
    for (const tier of tiers) {
      const t = prices[tier]
      if (t?.market) return t.market
      if (t?.mid)    return t.mid
      if (t?.low)    return t.low
    }
    return 0
  }

  function addCard(card) {
    if (addedCards.find(c => c.id === card.id)) return
    const price = getBestPrice(card)
    setAddedCards(prev => [...prev, {
      id: card.id,
      name: card.name,
      image: card.images?.small ?? '',
      market_price: price,
    }])
    setCardSearch('')
    setCardResults([])
  }

  function removeCard(id) {
    setAddedCards(prev => prev.filter(c => c.id !== id))
  }

  const totalValue = addedCards.reduce((s, c) => s + (c.market_price || 0), 0)

  async function handleSave() {
    if (!packName.trim()) { setError('Pack name is required.'); return }
    const price = parseFloat(packPrice) || 0
    setSaving(true)
    setError('')

    if (addedCards.length > 0) {
      const rows = addedCards.map(c => ({
        user_id: user.id,
        card_id: c.id,
        owned: true,
        market_price: c.market_price || null,
      }))
      await supabase.from('wishlists').upsert(rows, { onConflict: 'user_id,card_id' })
    }

    const { data, error: insertErr } = await supabase
      .from('pack_logs')
      .insert({
        user_id:     user.id,
        pack_name:   packName.trim(),
        pack_price:  price,
        total_value: totalValue,
        store:       store.trim() || null,
        cards:       addedCards.map(c => ({ id: c.id, name: c.name, image: c.image, market_price: c.market_price })),
      })
      .select()
      .single()

    setSaving(false)
    if (insertErr) { setError('Failed to save. Please try again.'); return }
    onSaved(data)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-700">🎴 Log a Pack</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-0.5">
          {/* Pack Name with set suggestions */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Pack Name / Set</label>
            <input
              ref={nameRef}
              type="text"
              value={packName}
              onChange={e => handlePackNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="e.g. Stellar Crown, Twilight Masquerade…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              autoComplete="off"
            />
            {showSuggestions && setSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                {setSuggestions.map(s => (
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

          {/* Pack Price + Store row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">What you paid ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packPrice}
                onChange={e => setPackPrice(e.target.value)}
                placeholder="4.99"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Store (optional)</label>
              <input
                type="text"
                value={store}
                onChange={e => setStore(e.target.value)}
                placeholder="Target, eBay…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-300"
              />
            </div>
          </div>

          {/* Set restriction indicator */}
          {selectedSetId && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5">
              <span>🎯</span>
              <span>Card search limited to <strong>{packName}</strong></span>
              <button onClick={() => { setSelectedSetId(null) }} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}

          {/* Card Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Add Cards from this Pack</label>
            <div className="relative">
              <input
                type="text"
                value={cardSearch}
                onChange={e => setCardSearch(e.target.value)}
                placeholder="Search Pokémon card name…"
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
                      src={card.images?.small}
                      alt={card.name}
                      className="h-10 rounded-lg flex-shrink-0"
                      onError={e => { e.currentTarget.src = CARD_BACK }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{card.name}</div>
                      <div className="text-xs text-gray-400">{card.id}</div>
                    </div>
                    {getBestPrice(card) > 0 && (
                      <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">${getBestPrice(card).toFixed(2)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Added Cards */}
          {addedCards.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2">Cards pulled ({addedCards.length})</div>
              <div className="flex flex-wrap gap-2">
                {addedCards.map(c => (
                  <div key={c.id} className="relative group">
                    <img
                      src={c.image}
                      alt={c.name}
                      className="h-16 rounded-xl shadow-md"
                      onError={e => { e.currentTarget.src = CARD_BACK }}
                    />
                    <button
                      onClick={() => removeCard(c.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-400 text-white text-xs
                                 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
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
            Paid: <strong className="text-rose-500">${(parseFloat(packPrice) || 0).toFixed(2)}</strong>
          </span>
          {totalValue > 0 && (
            <span className="text-gray-500">
              Pack worth: <strong className="text-emerald-600">${totalValue.toFixed(2)}</strong>
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
            {saving ? 'Saving…' : 'Save Pack Log'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
