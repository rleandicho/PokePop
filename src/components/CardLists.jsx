/**
 * CardLists — shareable card lists (chase, trade, binder inventory, custom)
 * Rendered inside WishlistDashboard when activeTab === 'lists'.
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const LIST_TYPES = [
  { value: 'chase',  label: '🎯 Chase List',  color: 'bg-violet-100 text-violet-600 border-violet-200' },
  { value: 'binder', label: '📒 Binder List',  color: 'bg-pink-100   text-pink-600   border-pink-200'   },
  { value: 'trade',  label: '🤝 Trade List',   color: 'bg-sky-100    text-sky-600    border-sky-200'    },
  { value: 'custom', label: '✨ Custom',        color: 'bg-amber-100  text-amber-600  border-amber-200'  },
]

function typeMeta(type) {
  return LIST_TYPES.find(t => t.value === type) ?? LIST_TYPES[3]
}

const CARD_BACK = 'https://images.pokemontcg.io/cardback.jpg'

// ── Price helper ──────────────────────────────────────────────────────────────
function getBestPrice(row) {
  return row.holofoil_market ?? row.normal_market ?? row.reverse_holo_market
    ?? row.other_market ?? row.ebay_market ?? null
}

// ── New List modal ────────────────────────────────────────────────────────────
function NewListModal({ onSave, onClose }) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [listType,    setListType]    = useState('custom')
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), description: description.trim() || null, list_type: listType })
    setSaving(false)
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(255,209,220,0.78)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full relative"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/70 hover:bg-white
                     text-gray-400 hover:text-gray-600 flex items-center justify-center shadow-sm text-base">✕</button>

        <h2 className="text-lg font-bold text-pink-500 mb-4">New List ✨</h2>

        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Title</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. SV Cards I Need"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-4
                     focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white/80"
        />

        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {LIST_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setListType(t.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                ${listType === t.value ? t.color + ' ring-2 ring-offset-1 ring-pink-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
            >{t.label}</button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description <span className="font-normal normal-case">(optional)</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this list for?"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-5 resize-none
                     focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white/80"
        />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-2.5 rounded-2xl
                     transition-colors disabled:opacity-50"
        >{saving ? 'Creating…' : 'Create List ✨'}</motion.button>
      </motion.div>
    </motion.div>
  )
}

// ── Card search for adding to list ────────────────────────────────────────────
function CardSearch({ onAdd, existingIds }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('tcg_cards_with_price')
        .select('id, name, set_name, image_small, holofoil_market, normal_market, reverse_holo_market, other_market, ebay_market')
        .or(`name.ilike.%${query.trim()}%,english_name.ilike.%${query.trim()}%`)
        .eq('card_language', 'en')
        .order('release_date', { ascending: false })
        .limit(12)
      setResults(data ?? [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounce.current)
  }, [query])

  return (
    <div className="mb-4">
      <div className="relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search cards to add…"
          className="w-full text-sm border border-pink-200 rounded-2xl px-4 py-2.5
                     focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white/80 pr-8"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <div className="mt-2 rounded-2xl border border-pink-100 overflow-hidden bg-white shadow-md">
          {results.map(card => {
            const price = getBestPrice(card)
            const already = existingIds.has(card.id)
            return (
              <div key={card.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-pink-50 transition-colors border-b border-pink-50 last:border-0">
                <img src={card.image_small || CARD_BACK} alt={card.name}
                  className="w-8 h-11 object-cover rounded-md flex-shrink-0"
                  onError={e => { e.currentTarget.src = CARD_BACK }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700 truncate">{card.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{card.set_name}</p>
                </div>
                {price != null && (
                  <span className="text-xs font-bold text-pink-500 flex-shrink-0">${price.toFixed(2)}</span>
                )}
                <button
                  onClick={() => { onAdd(card); setQuery(''); setResults([]) }}
                  disabled={already}
                  className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-colors
                    ${already
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-pink-400 hover:bg-pink-500 text-white'}`}
                >{already ? 'Added' : '+ Add'}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── List detail view ──────────────────────────────────────────────────────────
function ListDetail({ list, user, onBack, onToast, onUpdated }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [prices,  setPrices]  = useState({})  // card_id → best_market_price

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('card_list_items')
        .select('*')
        .eq('list_id', list.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      setItems(data ?? [])

      // Fetch current prices for each card in the list
      if (data?.length) {
        const ids = [...new Set(data.map(i => i.card_id))]
        const { data: priceRows } = await supabase
          .from('tcg_cards_with_price')
          .select('id, holofoil_market, normal_market, reverse_holo_market, other_market, ebay_market')
          .in('id', ids)
        const map = {}
        for (const r of priceRows ?? []) map[r.id] = getBestPrice(r)
        setPrices(map)
      }
      setLoading(false)
    }
    load()
  }, [list.id])

  const existingIds = new Set(items.map(i => i.card_id))

  async function addCard(card) {
    const newItem = {
      list_id:    list.id,
      card_id:    card.id,
      card_name:  card.name,
      card_image: card.image_small,
      quantity:   1,
      sort_order: items.length,
    }
    const { data, error } = await supabase.from('card_list_items').insert(newItem).select().single()
    if (error) { onToast('Failed to add card'); return }
    setItems(prev => [...prev, data])
    const price = getBestPrice(card)
    if (price != null) setPrices(prev => ({ ...prev, [card.id]: price }))
    onToast(`${card.name} added to list ✨`)
    onUpdated?.()
  }

  async function removeItem(itemId) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await supabase.from('card_list_items').delete().eq('id', itemId)
    onUpdated?.()
  }

  async function updateQty(itemId, qty) {
    const val = Math.max(1, qty)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: val } : i))
    await supabase.from('card_list_items').update({ quantity: val }).eq('id', itemId)
  }

  function copyLink() {
    const url = `${window.location.origin}/list/${list.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalValue = items.reduce((sum, i) => sum + (prices[i.card_id] ?? 0) * (i.quantity ?? 1), 0)
  const meta = typeMeta(list.list_type)

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pt-2">
        <button onClick={onBack}
          className="mt-0.5 text-gray-400 hover:text-pink-400 transition-colors text-lg leading-none flex-shrink-0"
          title="Back to lists">←</button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-700 truncate">{list.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
            {list.description && (
              <span className="text-[11px] text-gray-400 truncate">{list.description}</span>
            )}
          </div>
        </div>
        <button
          onClick={copyLink}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
            ${copied
              ? 'bg-emerald-400 text-white border-emerald-400'
              : 'bg-white/70 text-gray-500 border-gray-200 hover:bg-pink-50 hover:text-pink-500 hover:border-pink-200'}`}
        >{copied ? '✓ Copied!' : '🔗 Share'}</button>
      </div>

      {/* Stats bar */}
      {items.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-pink-50 border border-pink-100 rounded-2xl px-4 py-2.5 text-center">
            <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide">Cards</p>
            <p className="text-xl font-bold text-pink-500">{items.reduce((s, i) => s + (i.quantity ?? 1), 0)}</p>
          </div>
          {totalValue > 0 && (
            <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 text-center">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Est. Value</p>
              <p className="text-xl font-bold text-emerald-600">${totalValue.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Add card search */}
      <CardSearch onAdd={addCard} existingIds={existingIds} />

      {/* Items grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <motion.div className="w-8 h-8 rounded-full border-4 border-pink-300 border-t-pink-500"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-300">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm font-medium">No cards yet — search above to add some</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          <AnimatePresence>
            {items.map(item => {
              const price = prices[item.card_id]
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="rounded-2xl overflow-hidden shadow-sm border border-pink-50 bg-white relative"
                >
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-white/80 text-gray-400
                               hover:text-red-400 hover:bg-white text-[10px] leading-none flex items-center justify-center shadow-sm"
                    title="Remove">✕</button>
                  <img src={item.card_image || CARD_BACK} alt={item.card_name}
                    className="w-full" loading="lazy"
                    onError={e => { e.currentTarget.src = CARD_BACK }} />
                  <div className="p-1.5 text-center">
                    <p className="text-[10px] font-semibold text-gray-700 truncate leading-tight">{item.card_name}</p>
                    {price != null
                      ? <p className="text-[10px] font-bold text-pink-500">${price.toFixed(2)}</p>
                      : <p className="text-[10px] text-gray-300">—</p>
                    }
                    {/* Quantity stepper */}
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <button onClick={() => updateQty(item.id, (item.quantity ?? 1) - 1)}
                        className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold
                                   hover:bg-pink-100 hover:text-pink-500 leading-none flex items-center justify-center">−</button>
                      <span className="text-[10px] font-semibold text-gray-600 w-3 text-center">{item.quantity ?? 1}</span>
                      <button onClick={() => updateQty(item.id, (item.quantity ?? 1) + 1)}
                        className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold
                                   hover:bg-pink-100 hover:text-pink-500 leading-none flex items-center justify-center">+</button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CardLists({ user, onToast }) {
  const [lists,       setLists]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [activeList,  setActiveList]  = useState(null)
  const [itemCounts,  setItemCounts]  = useState({})  // list_id → count

  useEffect(() => {
    loadLists()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLists() {
    setLoading(true)
    const { data } = await supabase
      .from('card_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLists(data ?? [])

    if (data?.length) {
      const { data: counts } = await supabase
        .from('card_list_items')
        .select('list_id, id')
        .in('list_id', data.map(l => l.id))
      const map = {}
      for (const r of counts ?? []) {
        map[r.list_id] = (map[r.list_id] ?? 0) + 1
      }
      setItemCounts(map)
    }
    setLoading(false)
  }

  async function createList({ title, description, list_type }) {
    const { data, error } = await supabase
      .from('card_lists')
      .insert({ user_id: user.id, title, description, list_type })
      .select()
      .single()
    if (error) { onToast('Failed to create list'); return }
    setLists(prev => [data, ...prev])
    setShowNew(false)
    onToast(`List "${title}" created! ✨`)
    setActiveList(data)
  }

  async function deleteList(listId) {
    setLists(prev => prev.filter(l => l.id !== listId))
    await supabase.from('card_lists').delete().eq('id', listId)
    onToast('List deleted')
  }

  async function togglePublic(list) {
    const newVal = !list.is_public
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, is_public: newVal } : l))
    await supabase.from('card_lists').update({ is_public: newVal }).eq('id', list.id)
    onToast(newVal ? 'List is now public 🔗' : 'List set to private 🔒')
  }

  if (activeList) {
    return (
      <ListDetail
        list={activeList}
        user={user}
        onBack={() => setActiveList(null)}
        onToast={onToast}
        onUpdated={() => {
          setItemCounts(prev => ({ ...prev, [activeList.id]: (prev[activeList.id] ?? 0) + 1 }))
        }}
      />
    )
  }

  return (
    <div className="px-4 pb-8">
      {/* Header row */}
      <div className="flex items-center justify-between py-4">
        <h2 className="text-base font-bold text-gray-600">My Lists 📋</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full
                     bg-pink-400 hover:bg-pink-500 text-white transition-colors shadow-sm"
        >+ New List</motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <motion.div className="w-8 h-8 rounded-full border-4 border-pink-300 border-t-pink-500"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-gray-300">
          <p className="text-5xl mb-3">📋</p>
          <p className="text-sm font-medium text-gray-400 mb-1">No lists yet</p>
          <p className="text-xs text-gray-300">Create a chase list, trade list, or binder inventory to share with others</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNew(true)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full
                       bg-pink-100 hover:bg-pink-200 text-pink-600 transition-colors"
          >+ Create your first list</motion.button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.map(list => {
            const meta  = typeMeta(list.list_type)
            const count = itemCounts[list.id] ?? 0
            return (
              <motion.div
                key={list.id}
                layout
                className="bg-white rounded-2xl shadow-sm border border-pink-50 p-4 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveList(list)}>
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-700 truncate">{list.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${meta.color}`}>{meta.label}</span>
                  </div>
                  {list.description && (
                    <p className="text-[11px] text-gray-400 truncate mb-0.5">{list.description}</p>
                  )}
                  <p className="text-[10px] text-gray-300">{count} card{count !== 1 ? 's' : ''}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Public toggle */}
                  <button
                    onClick={() => togglePublic(list)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all
                      ${list.is_public
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                    title={list.is_public ? 'Click to make private' : 'Click to make public'}
                  >{list.is_public ? '🔗 Public' : '🔒 Private'}</button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteList(list.id)}
                    className="w-7 h-7 rounded-full bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-400
                               flex items-center justify-center text-sm transition-colors"
                    title="Delete list"
                  >🗑️</button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showNew && <NewListModal onSave={createList} onClose={() => setShowNew(false)} />}
      </AnimatePresence>
    </div>
  )
}
