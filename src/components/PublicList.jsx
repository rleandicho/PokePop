/**
 * PublicList — read-only public view of a shared card list.
 * Route: /list/:listId
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const CARD_BACK = 'https://images.pokemontcg.io/cardback.jpg'

const LIST_TYPE_META = {
  chase:  { label: '🎯 Chase List',  color: 'text-violet-600 bg-violet-100 border-violet-200' },
  binder: { label: '📒 Binder List', color: 'text-pink-600   bg-pink-100   border-pink-200'   },
  trade:  { label: '🤝 Trade List',  color: 'text-sky-600    bg-sky-100    border-sky-200'    },
  custom: { label: '✨ Custom',       color: 'text-amber-600  bg-amber-100  border-amber-200'  },
}

function getBestPrice(row) {
  return row.holofoil_market ?? row.normal_market ?? row.reverse_holo_market
    ?? row.other_market ?? row.ebay_market ?? null
}

export default function PublicList() {
  const { listId } = useParams()
  const [list,    setList]    = useState(null)
  const [owner,   setOwner]   = useState(null)
  const [items,   setItems]   = useState([])
  const [prices,  setPrices]  = useState({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      // Fetch list
      const { data: listData, error: listErr } = await supabase
        .from('card_lists')
        .select('*')
        .eq('id', listId)
        .single()

      if (listErr || !listData) { setError('List not found or is private.'); setLoading(false); return }
      if (!listData.is_public)  { setError('This list is private.');         setLoading(false); return }
      setList(listData)

      // Fetch owner profile + items in parallel
      const [{ data: profileData }, { data: itemData }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', listData.user_id).maybeSingle(),
        supabase.from('card_list_items').select('*').eq('list_id', listId)
          .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      ])

      setOwner(profileData)
      setItems(itemData ?? [])

      // Fetch prices
      if (itemData?.length) {
        const ids = [...new Set(itemData.map(i => i.card_id))]
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
  }, [listId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%)' }}>
        <motion.div className="w-10 h-10 rounded-full border-4 border-pink-300 border-t-pink-500"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
           style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%)' }}>
        <p className="text-4xl">🔒</p>
        <p className="text-gray-500 font-medium text-center">{error}</p>
        <Link to="/" className="text-sm text-pink-500 hover:underline">← Back to Poképop</Link>
      </div>
    )
  }

  const meta       = LIST_TYPE_META[list.list_type] ?? LIST_TYPE_META.custom
  const totalValue = items.reduce((sum, i) => sum + (prices[i.card_id] ?? 0) * (i.quantity ?? 1), 0)
  const totalCards = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0)

  return (
    <div className="min-h-screen pb-16 px-4"
         style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%)' }}>
      <div className="max-w-2xl mx-auto pt-8">

        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-600
                                 font-semibold mb-6 transition-colors">
          ← Poképop
        </Link>

        {/* List header */}
        <div className="bg-white rounded-3xl shadow-lg p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-pink-500 mb-1 truncate">{list.title}</h1>
              {list.description && (
                <p className="text-sm text-gray-400 mb-2">{list.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                {owner?.username && (
                  <span className="text-[11px] text-gray-400">by <span className="font-semibold text-gray-500">{owner.username}</span></span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {items.length > 0 && (
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-pink-50 border border-pink-100 rounded-2xl px-4 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide">Cards</p>
                <p className="text-xl font-bold text-pink-500">{totalCards}</p>
              </div>
              {totalValue > 0 && (
                <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 text-center">
                  <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Est. Value</p>
                  <p className="text-xl font-bold text-emerald-600">${totalValue.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card grid */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-gray-400 text-sm font-medium">This list is empty</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-3 sm:grid-cols-4 gap-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          >
            {items.map(item => {
              const price = prices[item.card_id]
              return (
                <motion.div
                  key={item.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  className="rounded-2xl overflow-hidden shadow-md bg-white"
                >
                  <img src={item.card_image || CARD_BACK} alt={item.card_name}
                    className="w-full"
                    onError={e => { e.currentTarget.src = CARD_BACK }} />
                  <div className="p-2 text-center">
                    <p className="text-[11px] font-semibold text-gray-700 truncate leading-tight">{item.card_name}</p>
                    {price != null
                      ? <p className="text-xs font-bold text-pink-500">${price.toFixed(2)}</p>
                      : <p className="text-xs text-gray-300">—</p>
                    }
                    {(item.quantity ?? 1) > 1 && (
                      <p className="text-[10px] text-gray-400">×{item.quantity}</p>
                    )}
                    {item.note && (
                      <p className="text-[9px] text-gray-400 truncate mt-0.5 italic">{item.note}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        <p className="text-center text-xs text-gray-300 mt-8">
          Made with <span className="text-pink-300">♥</span> on{' '}
          <Link to="/" className="text-pink-400 hover:underline">Poképop</Link>
        </p>
      </div>
    </div>
  )
}
