import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import CardSkeleton from './CardSkeleton'

const PAGE_SIZE = 20

// ─── Sort options ─────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { id: 'oldest',    label: 'Release Date (Oldest)', param: 'set.releaseDate' },
  { id: 'newest',    label: 'Release Date (Newest)', param: '-set.releaseDate' },
  { id: 'alpha',     label: 'Alphabetical (A–Z)',    param: 'name' },
  { id: 'price-high', label: 'Price (High → Low)',    param: null },   // client-side desc
  { id: 'price-low',  label: 'Price (Low → High)',   param: null },   // client-side asc
]

// ─── Vibe → TCG query mapping ─────────────────────────────────────────────────
// name-based vibes use `names` arrays — all are OR'd together for consistent results
const VIBE_QUERIES = {
  girlypop:    { names: ['cleffa', 'sylveon', 'alcremie', 'jigglypuff', 'togepi', 'snubbull', 'togekiss', 'clefairy', 'chansey', 'happiny', 'mew', 'eevee'] },
  // Space: named space Pokémon + background-aware flavor/set keywords to catch non-space Pokémon
  // depicted in starry/lunar/cosmic scenes (e.g. Clefairy on a moonlit mountain).
  space: { query: '((name:lunala OR name:cosmog OR name:cosmoem OR name:minior OR name:jirachi OR name:elgyem OR name:beheeyem OR name:deoxys OR name:solrock OR name:lunatone OR name:cresselia OR name:stakataka OR name:nihilego OR name:solgaleo) OR set.name:"Cosmic Eclipse" OR flavorText:space OR flavorText:galaxy OR flavorText:moon OR flavorText:meteor OR flavorText:celestial OR flavorText:cosmic OR flavorText:lunar)' },
  pastel:      { type: 'fairy' },
  cottagecore: { names: ['comfey', 'roselia', 'cherubi', 'shaymin', 'tangela', 'bellossom', 'flabebe', 'floette', 'florges', 'gossifleur', 'eldegoss'] },
  darkfairy:   { names: ['misdreavus', 'mismagius', 'gardevoir', 'hatterene', 'grimmsnarl', 'dragapult', 'gengar', 'spiritomb'] },
  nature:      { type: 'grass' },
  // Full Art: catches Sword & Shield / older "Full Art" subtypes AND modern SV rarities
  fullart:     { query: '(subtypes:"Full Art" OR rarity:"Special Illustration Rare" OR rarity:"Illustration Rare" OR rarity:"Hyper Rare")' },
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

// Sort price uses the same source as the displayed PriceTag to avoid visible mismatches.
function getCardPrice(card) {
  return getBestPrice(card.tcgplayer?.prices ?? {})
}

// Returns the q= value, or null for "all cards" (no filter)
function buildTcgQuery(vibe, search, setQuery) {
  // Strip characters that could break the Lucene query syntax
  if (search)   return `name:"*${search.replace(/["()]/g, '').trim()}*"`
  if (setQuery) return setQuery                // e.g. set.id:sv1 or set.series:"Scarlet & Violet"
  if (vibe === 'all') return null              // all cards, no filter
  const cfg = VIBE_QUERIES[vibe]
  if (!cfg) return null
  if (cfg.query) return cfg.query              // raw query string (e.g. fullart)
  if (cfg.type)  return `types:${cfg.type}`
  // OR all names together for consistent, full-vibe results
  return `(${cfg.names.map(n => `name:${n}`).join(' OR ')})`
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
    <div className="flex justify-end items-center flex-wrap px-4 pt-2 pb-1 gap-2">
      <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Sort by</span>
      <div className="relative">
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value)}
          className="appearance-none bg-white/70 border border-pink-200 text-pink-600 text-xs
                     font-semibold rounded-full pl-3 pr-7 py-1.5 focus:outline-none
                     focus:ring-2 focus:ring-pink-300 cursor-pointer shadow-sm hover:bg-white/90
                     transition-all max-w-[200px]"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-pink-400 text-xs">
          ▾
        </span>
      </div>
    </div>
  )
}

function CardModal({ card, user, onToast, onClose, activeBinderId }) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const prices    = card.tcgplayer?.prices ?? {}
  const priceRows = Object.entries(prices).filter(([, v]) => v?.market)

  async function addToWishlist() {
    if (!user) return
    setSaving(true)
    const payload = {
      user_id:      user.id,
      card_id:      card.id,
      name:         card.name,
      image:        card.images?.small,
      market_price: getBestPrice(prices),
    }
    // Route to the active binder if one is selected in the Dashboard
    if (activeBinderId) payload.binder_id = activeBinderId

    const { error } = await supabase
      .from('wishlists')
      .upsert(payload, { onConflict: 'user_id,card_id' })
    setSaving(false)
    if (!error) { setSaved(true); onToast('Saved to Wishlist & Collection! ✨📦') }
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
              {saved ? 'Saved! ✨📦' : saving ? 'Saving…' : '✨ Add to Wishlist & Collection'}
            </button>
          ) : (
            <p className="text-center text-xs text-gray-400">Login to save cards to your Wishlist & Collection 💖</p>
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
function CardGrid({ activeVibe, search, setQuery, sortBy, onSortChange, user, onToast, activeBinderId }) {
  const [cards,    setCards]    = useState([])
  const [page,     setPage]     = useState(1)
  const [hasMore,  setHasMore]  = useState(false)
  // Start as true when a filter is already active so skeletons show on the very first paint
  const [loading,  setLoading]  = useState(() => !!(activeVibe || setQuery || search))
  const [selected, setSelected] = useState(null)

  const abortRef = useRef(null)
  const reqIdRef = useRef(0)   // increments with every new request; stale responses check this

  const fetchCards = useCallback(async (vibe, srch, sq, sort, pg) => {
    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    // Stamp this request so we can discard responses that arrive out of order
    const reqId = ++reqIdRef.current

    setLoading(true)

    const q          = buildTcgQuery(vibe, srch, sq)
    const sortOption = SORT_OPTIONS.find(o => o.id === sort) ?? SORT_OPTIONS[0]
    // Price sorts are client-side; use oldest-first from the API for a stable page window
    const orderParam = sortOption.param ?? 'set.releaseDate'

    let url = `https://api.pokemontcg.io/v2/cards?page=${pg}&pageSize=${PAGE_SIZE}&orderBy=${encodeURIComponent(orderParam)}&select=id,name,images,set,rarity,tcgplayer,cardmarket`
    if (q) url += `&q=${encodeURIComponent(q)}`

    try {
      const res = await fetch(url, { signal })

      // A newer request has already started — discard this response entirely
      if (reqIdRef.current !== reqId) return

      const data = await res.json()
      const incoming = data.data ?? []

      // Merge first, THEN sort the entire accumulated list so prices are globally ordered.
      // Without this, each page would be sorted in isolation and correct ordering breaks on "Load More".
      setCards(prev => {
        const all = pg === 1 ? incoming : [...prev, ...incoming]
        if (sort === 'price-high') return [...all].sort((a, b) => getCardPrice(b) - getCardPrice(a))
        if (sort === 'price-low')  return [...all].sort((a, b) => getCardPrice(a) - getCardPrice(b))
        return all
      })
      setHasMore(incoming.length === PAGE_SIZE)
    } catch (err) {
      if (err.name === 'AbortError') return   // intentional cancel — leave loading state alone
      setHasMore(false)
    }

    // Only clear loading if this is still the active request
    if (reqIdRef.current === reqId) setLoading(false)
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

      {(sortBy === 'price-high' || sortBy === 'price-low') && (
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
            style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.6)', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
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

      {loading && cards.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
          {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {loading && cards.length > 0 && (
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
          <CardModal card={selected} user={user} onToast={onToast} onClose={() => setSelected(null)} activeBinderId={activeBinderId} />
        )}
      </AnimatePresence>
    </>
  )
}

export default memo(CardGrid)
