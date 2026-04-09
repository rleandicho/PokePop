import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

// ─── Sort options ─────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { id: 'oldest',    label: 'Release Date (Oldest)', param: 'set.releaseDate' },
  { id: 'newest',    label: 'Release Date (Newest)', param: '-set.releaseDate' },
  { id: 'alpha',     label: 'Alphabetical (A–Z)',    param: 'name' },
  { id: 'price',     label: 'Price (High → Low)',    param: null },   // client-side desc
  { id: 'price-asc', label: 'Price (Low → High)',    param: null },   // client-side asc
]

// ─── Vibe → TCG query mapping ─────────────────────────────────────────────────
const VIBE_QUERIES = {
  girlypop:    { names: ['cleffa', 'sylveon', 'alcremie', 'jigglypuff', 'togepi', 'snubbull', 'togekiss', 'clefairy'] },
  space:       { names: ['cleffa', 'lunala', 'cosmog', 'minior', 'staryu', 'starmie', 'jirachi'] },
  pastel:      { type: 'fairy' },
  cottagecore: { names: ['comfey', 'roselia', 'cherubi', 'shaymin', 'tangela', 'bellossom'] },
  darkfairy:   { names: ['misdreavus', 'mismagius', 'gardevoir', 'hatterene'] },
  nature:      { type: 'grass' },
}

function getBestPrice(prices = {}) {
  return (
    prices.holofoil?.market ??
    prices.reverseHolofoil?.market ??
    prices.normal?.market ??
    Object.values(prices).find(p => p?.market)?.market ??
    0
  )
}

// Returns the q= value, or null for "all cards" (no filter)
function buildTcgQuery(vibe, search, setQuery) {
  if (search)   return `name:"*${search}*"`
  if (setQuery) return setQuery                // e.g. set.id:sv1 or set.series:"Scarlet & Violet"
  if (vibe === 'all') return null              // all cards, no filter
  const cfg = VIBE_QUERIES[vibe]
  if (!cfg) return null
  if (cfg.type) return `types:${cfg.type}`
  return `name:${cfg.names[Math.floor(Math.random() * cfg.names.length)]}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function PriceTag({ prices }) {
  const val = getBestPrice(prices)
  if (!val) return null
  return (
    <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
      ${val.toFixed(2)}
    </span>
  )
}

function SortToolbar({ sortBy, onSortChange }) {
  return (
    <div className="flex justify-end items-center px-4 pt-2 pb-1 gap-2">
      <span className="text-xs text-gray-400 font-medium">Sort by</span>
      <div className="relative">
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value)}
          className="appearance-none bg-white/70 border border-pink-200 text-pink-600 text-xs
                     font-semibold rounded-full pl-3 pr-7 py-1.5 focus:outline-none
                     focus:ring-2 focus:ring-pink-300 cursor-pointer shadow-sm hover:bg-white/90
                     transition-all"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {/* custom chevron */}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-pink-400 text-xs">
          ▾
        </span>
      </div>
    </div>
  )
}

function CardModal({ card, user, onToast, onClose }) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const prices    = card.tcgplayer?.prices ?? {}
  const priceRows = Object.entries(prices).filter(([, v]) => v?.market)

  async function addToWishlist() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('wishlists').upsert({
      user_id:      user.id,
      card_id:      card.id,
      name:         card.name,
      image:        card.images?.small,
      market_price: getBestPrice(prices),
    }, { onConflict: 'user_id,card_id' })
    setSaving(false)
    if (!error) { setSaved(true); onToast('Saved to Wishlist! 💖') }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(255,209,220,0.6)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white/85 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-w-sm w-full my-auto"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <img src={card.images?.large ?? card.images?.small} alt={card.name}
             className="w-full rounded-2xl mb-4 shadow-md" />
        <h2 className="text-xl font-bold text-pink-500 mb-0.5">{card.name}</h2>
        <p className="text-sm text-gray-400 mb-3">{card.set?.name} · {card.rarity}</p>

        {priceRows.length > 0 && (
          <div className="mb-4 space-y-1 bg-pink-50/60 rounded-2xl p-3">
            {priceRows.map(([variant, p]) => (
              <div key={variant} className="flex justify-between text-sm">
                <span className="text-gray-500 capitalize">{variant.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-semibold text-pink-600">${p.market?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {user ? (
            <button
              onClick={addToWishlist}
              disabled={saving || saved}
              className="bg-rose-400 hover:bg-rose-500 disabled:opacity-60 text-white
                         font-semibold py-2 rounded-2xl transition-colors"
            >
              {saved ? 'Added! 💖' : saving ? 'Saving…' : '✨ Add to Wishlist'}
            </button>
          ) : (
            <p className="text-center text-xs text-gray-400">Login to save cards to your wishlist 💖</p>
          )}
          {card.tcgplayer?.url && (
            <a href={card.tcgplayer.url} target="_blank" rel="noreferrer"
               className="block text-center bg-pink-400 hover:bg-pink-500 text-white
                          font-semibold py-2 rounded-2xl transition-colors">
              View on TCGPlayer
            </a>
          )}
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 mt-1">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main grid ────────────────────────────────────────────────────────────────
export default function CardGrid({ activeVibe, search, setQuery, sortBy, onSortChange, user, onToast }) {
  const [cards,    setCards]    = useState([])
  const [page,     setPage]     = useState(1)
  const [hasMore,  setHasMore]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchCards = useCallback(async (vibe, srch, sq, sort, pg) => {
    setLoading(true)

    const q           = buildTcgQuery(vibe, srch, sq)
    const sortOption  = SORT_OPTIONS.find(o => o.id === sort) ?? SORT_OPTIONS[0]
    // price sorts are client-side; still ask API for oldest-first for a stable result set
    const orderParam  = sortOption.param ?? 'set.releaseDate'

    let url = `https://api.pokemontcg.io/v2/cards?page=${pg}&pageSize=${PAGE_SIZE}&orderBy=${encodeURIComponent(orderParam)}&select=id,name,images,set,rarity,tcgplayer`
    if (q) url += `&q=${encodeURIComponent(q)}`

    try {
      const res  = await fetch(url)
      const data = await res.json()
      let incoming = data.data ?? []

      // Client-side price sort (API doesn't expose price ordering)
      if (sort === 'price') {
        incoming = [...incoming].sort((a, b) =>
          getBestPrice(b.tcgplayer?.prices) - getBestPrice(a.tcgplayer?.prices)
        )
      } else if (sort === 'price-asc') {
        incoming = [...incoming].sort((a, b) =>
          getBestPrice(a.tcgplayer?.prices) - getBestPrice(b.tcgplayer?.prices)
        )
      }

      setCards(prev => pg === 1 ? incoming : [...prev, ...incoming])
      setHasMore(incoming.length === PAGE_SIZE)
    } catch (_) {
      setHasMore(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const hasFilter = activeVibe || setQuery || search
    if (!hasFilter) return
    setPage(1)
    setCards([])
    fetchCards(activeVibe, search, setQuery, sortBy, 1)
  }, [activeVibe, search, setQuery, sortBy, fetchCards])

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchCards(activeVibe, search, setQuery, sortBy, next)
  }

  if (!activeVibe && !setQuery && !search) {
    return (
      <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
        Pick a vibe above to discover cards ✨
      </p>
    )
  }

  return (
    <>
      <SortToolbar sortBy={sortBy} onSortChange={onSortChange} />

      {(sortBy === 'price' || sortBy === 'price-asc') && (
        <p className="text-center text-xs text-gray-400 pb-1">
          Price sort applies per page of 20 cards
        </p>
      )}

      <motion.div
        key={`${activeVibe}-${setQuery}-${search}-${sortBy}`}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      >
        {cards.map(card => (
          <motion.div
            key={card.id}
            className="cursor-pointer rounded-2xl overflow-hidden shadow-md"
            style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)' }}
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.05, boxShadow: '0 12px 30px rgba(255,182,193,0.5)' }}
            onClick={() => setSelected(card)}
          >
            <img src={card.images?.small} alt={card.name} className="w-full" loading="lazy" />
            <div className="p-2 text-center">
              <p className="text-sm font-bold text-gray-700 truncate">{card.name}</p>
              <p className="text-xs text-gray-400 truncate mb-1">{card.set?.name}</p>
              <PriceTag prices={card.tcgplayer?.prices} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {loading && (
        <div className="flex justify-center py-8">
          <motion.div
            className="w-10 h-10 rounded-full border-4 border-pink-300 border-t-pink-500"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          />
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pb-10">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={loadMore}
            className="bg-white/70 hover:bg-white/90 text-pink-500 font-semibold
                       px-8 py-2.5 rounded-full shadow-md border border-pink-200 transition-all"
          >
            Load More ✨
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <CardModal card={selected} user={user} onToast={onToast} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
