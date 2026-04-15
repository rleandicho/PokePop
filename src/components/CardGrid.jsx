import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import CardSkeleton from './CardSkeleton'
import SearchBar from './SearchBar'
import { FIRST_ED_SET_IDS, get1stEdPrice } from '../lib/sets'

const PAGE_SIZE   = 20
const CACHE_LIMIT = 10  // max unique filter combinations held in memory

// ─── Sort options ─────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { id: 'oldest',    label: 'Release Date (Oldest)' },
  { id: 'newest',    label: 'Release Date (Newest)' },
  { id: 'alpha',     label: 'Alphabetical (A–Z)' },
  { id: 'price-high', label: 'Price (High → Low)' },
  { id: 'price-low',  label: 'Price (Low → High)' },
]

// ─── Vibe → TCG query mapping ─────────────────────────────────────────────────
// name-based vibes use `names` arrays — all are OR'd together for consistent results
const VIBE_QUERIES = {
  girlypop:    { names: ['cleffa', 'sylveon', 'alcremie', 'jigglypuff', 'togepi', 'snubbull', 'togekiss', 'clefairy', 'chansey', 'happiny', 'mew', 'eevee'] },
  trainers:    { query: '(supertype:trainer OR subtypes:item OR subtypes:supporter OR subtypes:stadium)' },
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

// Unlimited-only price lookup — explicitly skips all 1stEdition* tiers so unlimited
// cards never inherit 1st Ed prices (the "pricing leak" fix).
function getBestPrice(prices = {}) {
  return (
    prices.holofoil?.market ??
    prices.reverseHolofoil?.market ??
    prices.normal?.market ??
    // Generic fallback: any non-1stEdition tier — safe for non-standard sets like Perfect Order
    Object.entries(prices).find(([k, v]) => !k.startsWith('1stEdition') && v?.market != null)?.[1]?.market ??
    0
  )
}

// Edition-aware price resolver.
// 1st Ed cards check dedicated 1stEdition* tiers first, then fall back to Unlimited (Edition Swap).
// Unlimited cards ONLY use getBestPrice — they never touch 1stEdition* keys.
function getCardPrice(card) {
  if (card.market_price != null) return card.market_price
  const prices = card.tcgplayer?.prices ?? {}
  if (card._is1stEd) {
    // Prefer the dedicated 1st Ed tier; fall back to Unlimited as a baseline
    return (
      prices['1stEditionHolofoil']?.market ??
      prices['1stEditionNormal']?.market ??
      getBestPrice(prices)
    )
  }
  // Unlimited card: strictly non-1stEdition tiers
  return getBestPrice(prices)
}

// Stable cache key based only on filter identity — excludes sortBy so sort changes are local-only
function buildCacheKey(vibe, search, setQuery) {
  return `${vibe ?? ''}|${search ?? ''}|${setQuery ?? ''}`
}

// All sorting is local. Fetch always uses a stable API order (oldest-first) as the raw baseline.
// For price sorts, cards with no price data always sink to the bottom.
function sortCards(cards, sort) {
  const arr = [...cards]
  switch (sort) {
    case 'price-high':
      return arr.sort((a, b) => {
        const pa = getCardPrice(a), pb = getCardPrice(b)
        if (!pa && !pb) return 0
        if (!pa) return 1   // unpriced → bottom
        if (!pb) return -1
        return pb - pa
      })
    case 'price-low':
      return arr.sort((a, b) => {
        const pa = getCardPrice(a), pb = getCardPrice(b)
        if (!pa && !pb) return 0
        if (!pa) return 1   // unpriced → bottom
        if (!pb) return -1
        return pa - pb
      })
    case 'alpha':   return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'newest':  return arr.sort((a, b) => {
      const da = new Date(a.set?.releaseDate || '1900/01/01')
      const db = new Date(b.set?.releaseDate || '1900/01/01')
      return db - da   // newest first; cards with no date sink to the bottom
    })
    default:        return arr   // 'oldest' is the stable API fetch order — no sort needed
  }
}

// Builds the q= string sent to the TCG API.
// Parts are joined with a space — the API treats spaces as AND operators.
// Returns null when there is nothing to filter (renders "all cards" endpoint).
function buildTcgQuery(vibe, search, setQuery) {
  const parts = []

  // 1. Name search — wildcards let partial names match (e.g. "eev" → Eevee)
  const safeName = search ? search.replace(/["()]/g, '').trim() : ''
  if (safeName) parts.push(`name:"*${safeName}*"`)

  // 2. Set filter — passed through verbatim (e.g. "set.id:base1", "set.series:\"Base\"")
  if (setQuery) parts.push(setQuery)

  // 3. Vibe filter — skipped for 'all' or when vibe is null/undefined
  if (vibe && vibe !== 'all') {
    const cfg = VIBE_QUERIES[vibe]
    if (cfg) {
      // Raw query strings are wrapped in () so their internal OR clauses don't bleed
      // into the AND-joined parts (e.g. "name:*eevee* (supertype:Trainer OR ...)")
      if      (cfg.query) parts.push(`(${cfg.query})`)
      else if (cfg.type)  parts.push(`types:${cfg.type}`)
      else if (cfg.names) parts.push(`(${cfg.names.map(n => `name:${n}`).join(' OR ')})`)
    }
  }

  return parts.length ? parts.join(' ') : null
}

// ─── Sub-components ───────────────────────────────────────────────────────────
// For 1st Ed cards: shows the 1st Ed price when available; falls back to the
// Unlimited price as a baseline (Edition Swap). "N/A" shown only when neither
// edition nor unlimited has any price data.
// For regular cards: shows the best available Unlimited market price.
function PriceTag({ card }) {
  // All cards have market_price set at fetch time — no getBestPrice fallback needed.
  const val = card.market_price
  if (card._is1stEd) {
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
        ${val ? 'text-amber-700 bg-amber-100' : 'text-gray-400 bg-gray-100'}`}>
        {val ? `$${Number(val).toFixed(2)}` : 'N/A'}
      </span>
    )
  }
  if (!val) return null
  return (
    <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
      ${Number(val).toFixed(2)}
    </span>
  )
}

// Shows edition and card number badges so multiple printings are visually distinct.
// _is1stEd comes from the edition-split expansion in fetchCards.
function VariantBadges({ card }) {
  const is1stEd = card._is1stEd || card.subtypes?.includes('1st Edition')
  const num     = card.number
  if (!is1stEd && !num) return null
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap mt-0.5 mb-0.5">
      {is1stEd && (
        <span className="text-[9px] font-bold bg-amber-400 text-white
                         px-1.5 py-0.5 rounded-full border border-amber-500 leading-tight shadow-sm">
          ⭐ 1st Ed
        </span>
      )}
      {num && (
        <span className="text-[9px] text-gray-400 bg-gray-100
                         px-1.5 py-0.5 rounded-full leading-tight">
          #{num}
        </span>
      )}
    </div>
  )
}

function QuantityStepper({ value, onChange, compact = false }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${compact ? 'mt-1' : 'mt-2 mb-1'}`}>
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Qty</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500
                   font-bold text-sm leading-none transition-colors disabled:opacity-30"
      >
        −
      </button>
      <span className="text-xs font-bold text-gray-600 min-w-[1.25rem] text-center">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-emerald-100 text-gray-500
                   hover:text-emerald-600 font-bold text-sm leading-none transition-colors"
      >
        +
      </button>
    </div>
  )
}

// ─── Pagination bar ───────────────────────────────────────────────────────────
function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-6 flex-wrap">
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all
                   bg-white/60 border-gray-200 text-gray-500 hover:bg-white/80
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← Prev
      </motion.button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="text-gray-400 px-1 text-sm">…</span>
        ) : (
          <motion.button
            key={p}
            whileTap={{ scale: 0.93 }}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 rounded-full text-sm font-semibold border transition-all
              ${p === currentPage
                ? 'bg-pink-400 text-white border-pink-400 shadow-sm'
                : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
              }`}
          >
            {p}
          </motion.button>
        )
      )}

      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-all
                   bg-white/60 border-gray-200 text-gray-500 hover:bg-white/80
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next →
      </motion.button>
    </div>
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

function CardModal({ card, user, onToast, onClose, saveCard, collectionIds, ownedIds, onCardAdded, onCardRemoved }) {
  const [saving,   setSaving]   = useState(false)
  const [removing, setRemoving] = useState(false)
  const [quantity, setQuantity] = useState(1)
  // Start with the small image (already in cache from the grid tile) so the modal
  // opens instantly. Preload the large image in the background and swap when ready.
  const [imgSrc, setImgSrc] = useState(card.images?.small)
  useEffect(() => {
    if (!card.images?.large || card.images.large === card.images.small) return
    const img = new Image()
    img.onload = () => setImgSrc(card.images.large)
    img.src = card.images.large
  }, [card.images?.large]) // eslint-disable-line react-hooks/exhaustive-deps
  const prices     = card.tcgplayer?.prices ?? {}
  // 1st Ed variant: only show 1stEdition price rows so the modal matches the grid tile.
  // Regular card: exclude 1stEdition* tiers so unlimited cards never display 1st Ed prices.
  const priceRows  = card._is1stEd
    ? Object.entries(prices).filter(([k, v]) => k.startsWith('1stEdition') && v?.market)
    : Object.entries(prices).filter(([k, v]) => !k.startsWith('1stEdition') && v?.market)
  const inList     = collectionIds?.has(card.id)   // in wishlist OR collection
  const isOwned    = ownedIds?.has(card.id)        // specifically marked owned

  async function addCard(owned, qty = 1) {
    if (!user) return
    setSaving(true)
    const { error, toast } = await saveCard(card, owned, qty)
    /*
      name:         card._is1stEd ? `${card.name} ⭐` : card.name,
    */
    setSaving(false)
    if (!error) {
      onCardAdded?.(card.id, owned)
      onToast(owned ? 'Added to Collection! ✨📦' : 'Added to Wishlist! 💖')
    }
  }

  async function removeCard() {
    if (!user) return
    setRemoving(true)
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('card_id', card.id)
    setRemoving(false)
    if (!error) { onCardRemoved?.(card.id); onToast(isOwned ? 'Removed from Collection 🗑️' : 'Removed from Wishlist 🗑️') }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(255,209,220,0.78)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full my-auto relative"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/70 hover:bg-white
                     text-gray-400 hover:text-gray-600 flex items-center justify-center
                     shadow-sm transition-colors text-base leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <img src={imgSrc} alt={card.name}
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
            inList ? (
              /* Already saved — show which bucket it's in + remove option */
              <>
                <p className="text-center text-xs font-semibold text-gray-400">
                  {isOwned ? '✅ In your Collection' : '💖 In your Wishlist'}
                </p>
                <QuantityStepper value={quantity} onChange={setQuantity} />
                <button
                  onClick={() => addCard(true, quantity)}
                  disabled={saving}
                  className="bg-emerald-400 hover:bg-emerald-500 text-white
                             font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                >
                  {saving
                    ? 'Savingâ€¦'
                    : isOwned
                    ? `+ Add ${quantity} Cop${quantity === 1 ? 'y' : 'ies'}`
                    : `Move to Collection Ã—${quantity}`}
                </button>
                <button
                  onClick={removeCard}
                  disabled={removing}
                  className="border border-red-300 text-red-500 hover:bg-red-50
                             font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                >
                  {removing ? 'Removing…' : isOwned ? '🗑️ Remove from Collection' : '🗑️ Remove from Wishlist'}
                </button>
              </>
            ) : (
              /* Not yet saved — two distinct action buttons */
              <div className="space-y-2">
                <QuantityStepper value={quantity} onChange={setQuantity} />
                <div className="flex gap-2">
                  <button
                  onClick={() => addCard(false)}
                  disabled={saving}
                  className="flex-1 bg-violet-100 hover:bg-violet-200 text-violet-700
                             font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                >
                  {saving ? '…' : '💖 Wishlist'}
                </button>
                <button
                  onClick={() => addCard(true, quantity)}
                  disabled={saving}
                  className="flex-1 bg-emerald-400 hover:bg-emerald-500 text-white
                             font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                >
                  {saving ? '…' : '✨ Collection'}
                </button>
                </div>
              </div>
            )
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
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Card tile ────────────────────────────────────────────────────────────────
// memo: only re-renders when inList/isOwned change for this specific card.
// quickAdd/quickRemove are useCallback-stable so memo comparisons hold.
const CardTile = memo(function CardTile({ card, inList, isOwned, quickAdd, quickRemove, setSelected }) {
  const [ownedQty, setOwnedQty] = useState(1)

  return (
    <motion.div
      className="cursor-pointer rounded-2xl overflow-hidden shadow-md relative"
      style={{
        // Opaque backgrounds instead of backdropFilter:blur — same look, far cheaper to paint
        background: isOwned
          ? 'rgba(236,253,245,0.95)'
          : inList
          ? 'rgba(238,233,255,0.95)'
          : card._is1stEd
          ? 'rgba(255,251,235,0.97)'
          : 'rgba(255,255,255,0.92)',
        border: isOwned
          ? '1.5px solid #6ee7b7'
          : inList
          ? '1.5px solid #a78bfa'
          : card._is1stEd
          ? '1.5px solid #fbbf24'
          : '1px solid rgba(255,255,255,0.6)',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation',
      }}
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.04 }}
      onClick={() => setSelected(card)}
    >
      {inList && (
        <span className={`absolute top-1.5 left-1.5 z-10 text-[9px] font-bold
                          px-1.5 py-0.5 rounded-full leading-tight shadow-sm
                          ${isOwned ? 'bg-emerald-500/90 text-white' : 'bg-violet-500/90 text-white'}`}>
          {isOwned ? '✅ Owned' : '💖 Wishlist'}
        </span>
      )}
      {inList && (
        <button
          onClick={e => quickRemove(e, card)}
          className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full flex items-center
                     justify-center text-xs font-bold shadow-sm transition-colors leading-none
                     bg-white/80 hover:bg-red-400 hover:text-white text-red-400"
          title="Remove from Collection"
        >
          −
        </button>
      )}
      <img src={card.images?.small} alt={card.name} className="w-full" loading="lazy" />
      <div className="p-2 text-center">
        <p className="text-sm font-bold text-gray-700 truncate">{card.name}</p>
        <p className="text-xs text-gray-400 truncate">{card.set?.name}</p>
        <VariantBadges card={card} />
        <PriceTag card={card} />
        {(isOwned || !inList) && (
          <div onClick={e => e.stopPropagation()}>
            <QuantityStepper value={ownedQty} onChange={setOwnedQty} compact />
          </div>
        )}
        {isOwned && (
          <button
            onClick={e => quickAdd(e, card, true, ownedQty)}
            className="w-full mt-1 text-[10px] font-semibold py-1 rounded-xl
                       bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
            title="Add more copies to Collection"
          >
            + {ownedQty} Cop{ownedQty === 1 ? 'y' : 'ies'}
          </button>
        )}
        {!inList && (
          <div className="flex gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => quickAdd(e, card, false)}
              className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                         bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors"
              title="Add to Wishlist"
            >
              💖 Wishlist
            </button>
            <button
              onClick={e => quickAdd(e, card, true, ownedQty)}
              className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                         bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
              title="Add to Collection"
            >
              ✨ Owned
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
})

// ─── Main grid ────────────────────────────────────────────────────────────────
function CardGrid({ activeVibe, search, setQuery, sortBy, onSortChange, user, onToast, activeBinderId, collectionIds, ownedIds, onCardAdded, onCardRemoved }) {
  const [cards,      setCards]      = useState([])
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  // Start as true when a filter is already active so skeletons show on the very first paint
  const [loading,  setLoading]  = useState(() => !!(activeVibe || setQuery || search))
  const [selected, setSelected] = useState(null)

  const abortRef     = useRef(null)
  const reqIdRef     = useRef(0)    // increments with every new request; stale responses check this
  // Per-filter cache: cacheKey → { rawCards, page, totalPages }
  // Raw cards are in stable API order (oldest-first); sorting is applied on top locally.
  const cacheRef     = useRef({})
  const cacheKeysRef = useRef([])   // insertion-order key list for CACHE_LIMIT eviction
  const activeKeyRef = useRef(null) // tracks which filter combination is currently active

  // ── Inline debounced search ─────────────────────────────────────────────────
  // inlineSearch  — raw value bound to SearchBar (updates every keystroke)
  // debouncedInline — settled value after 500 ms of quiet (drives fetch)
  // effectiveSearch — debouncedInline wins; falls back to the header `search` prop
  const [inlineSearch,    setInlineSearch]    = useState('')
  const [debouncedInline, setDebouncedInline] = useState('')
  const searchTimerRef = useRef(null)

  useEffect(() => {
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(
      () => setDebouncedInline(inlineSearch.trim()),
      500,
    )
    return () => clearTimeout(searchTimerRef.current)
  }, [inlineSearch])

  // Reset inline search when the active vibe or set filter changes
  useEffect(() => {
    setInlineSearch('')
    setDebouncedInline('')
    clearTimeout(searchTimerRef.current)
  }, [activeVibe, setQuery])

  const effectiveSearch = debouncedInline || search

  function handleInlineClear() {
    setInlineSearch('')
    setDebouncedInline('')   // clear immediately — no 500 ms wait on reset
    clearTimeout(searchTimerRef.current)
  }

  const fetchCards = useCallback(async (vibe, srch, sq, sort, pg) => {
    const key = buildCacheKey(vibe, srch, sq)
    activeKeyRef.current = key

    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    // Stamp this request so we can discard responses that arrive out of order
    const reqId = ++reqIdRef.current

    setLoading(true)

    const q = buildTcgQuery(vibe, srch, sq)
    // Always fetch in stable oldest-first order — all sort options are applied locally.
    // number + subtypes added so variant badges ("1st Ed", "#4/102") render without a second fetch
    // Map local sort option to the API's orderBy field.
    // Price sorts have no API equivalent — fetch newest-first and re-sort locally.
    const apiOrder = sort === 'oldest' ? 'set.releaseDate'
                   : sort === 'alpha'  ? 'name'
                   : '-set.releaseDate'   // newest, price-high, price-low
    let url = `https://api.pokemontcg.io/v2/cards?page=${pg}&pageSize=${PAGE_SIZE}&orderBy=${encodeURIComponent(apiOrder)}&select=id,name,images,set,number,subtypes,rarity,tcgplayer,cardmarket`
    if (q) url += `&q=${encodeURIComponent(q)}`

    try {
      const res = await fetch(url, { signal })

      // A newer request has already started — discard this response entirely
      if (reqIdRef.current !== reqId) return

      const data = await res.json()
      const incoming = data.data ?? []
      const total = Math.ceil((data.totalCount ?? 0) / PAGE_SIZE)

      // ── Edition split — expand WotC-era cards into Unlimited + 1st Ed variants ──
      // The 1st Ed copy gets a -1st suffix on its ID so it is treated as a distinct
      // card everywhere (collection tracking, DB key, price lookup, etc.)
      const expanded = []
      for (const card of incoming) {
        const tcg = card.tcgplayer?.prices

        // UNLIMITED — pick the best non-1stEdition tier (same priority as getBestPrice)
        // and read market/mid/low from it so all three come from the same tier.
        const unlTier = (
          (tcg?.holofoil?.market        != null && tcg.holofoil)        ||
          (tcg?.reverseHolofoil?.market != null && tcg.reverseHolofoil) ||
          (tcg?.normal?.market          != null && tcg.normal)          ||
          Object.entries(tcg ?? {}).find(([k, v]) => !k.startsWith('1stEdition') && v?.market != null)?.[1] ||
          null
        )
        const priceUnl = unlTier?.market ?? null
        const midUnl   = unlTier?.mid    ?? null
        const lowUnl   = unlTier?.low    ?? null

        // 1ST ED — strictly these two keys, never falls back to Unlimited
        const price1st = tcg?.['1stEditionHolofoil']?.market || tcg?.['1stEditionNormal']?.market || null
        const mid1st   = tcg?.['1stEditionHolofoil']?.mid    || tcg?.['1stEditionNormal']?.mid    || null
        const low1st   = tcg?.['1stEditionHolofoil']?.low    || tcg?.['1stEditionNormal']?.low    || null

        // UPDATE ORIGINAL CARD — attach all three price points so payloads are complete
        card.market_price = priceUnl
        card.mid_price    = midUnl
        card.low_price    = lowUnl

        expanded.push(card)

        // CREATE VARIANT — spawn for every confirmed WotC set.
        // Edition Swap: falls back to Unlimited price when no dedicated 1st Ed tier exists.
        if (FIRST_ED_SET_IDS.has(card.set?.id)) {
          // Edition Swap: if TCGPlayer has no dedicated 1st Ed tier, use Unlimited as a
          // price baseline so cards never show "N/A". The amber badge still marks them.
          const variant = {
            ...card,
            id:           `${card.id}-1st`,
            _is1stEd:     true,
            market_price: price1st ?? priceUnl,
            mid_price:    mid1st   ?? midUnl,
            low_price:    low1st   ?? lowUnl,
          }
          expanded.push(variant)
        }
      }

      // Store only the current page — no accumulation across pages
      const rawCards = expanded

      // Write to cache with LRU eviction — cap at CACHE_LIMIT unique filter combinations
      const keyList = cacheKeysRef.current
      const existing = keyList.indexOf(key)
      if (existing !== -1) keyList.splice(existing, 1)
      if (keyList.length >= CACHE_LIMIT) {
        const evicted = keyList.shift()
        delete cacheRef.current[evicted]
      }
      keyList.push(key)
      cacheRef.current[key] = { rawCards, page: pg, totalPages: total }

      setCards(sortCards(rawCards, sort))
      setTotalPages(total)
    } catch (err) {
      if (err.name === 'AbortError') return   // intentional cancel — leave loading state alone
      setTotalPages(0)
    }

    // Only clear loading if this is still the active request
    if (reqIdRef.current === reqId) setLoading(false)
  }, [])

  // Filter OR sort change: re-fetch or serve from cache.
  // sortBy is included so switching Oldest ↔ Newest triggers a new API call with the
  // correct orderBy. For price/alpha sorts the API result is the same (newest-first)
  // and local re-sort handles it — but we still bust the cache so the data stays fresh.
  useEffect(() => {
    const hasFilter = activeVibe || setQuery || effectiveSearch
    if (!hasFilter) return

    const key = buildCacheKey(activeVibe, effectiveSearch, setQuery)
    activeKeyRef.current = key

    // Date sorts change the API orderBy → stale cache would be in the wrong server order,
    // so evict the entry and force a fresh fetch.
    const isDateSort = sortBy === 'oldest' || sortBy === 'newest'
    if (isDateSort) delete cacheRef.current[key]

    const cached = cacheRef.current[key]

    // Always cancel any in-flight request when filter/sort changes.
    abortRef.current?.abort()
    reqIdRef.current++

    if (cached) {
      // Cache hit (non-date sorts): re-sort locally — zero network, zero flicker
      setCards(sortCards(cached.rawCards, sortBy))
      setPage(1)
      setTotalPages(cached.totalPages ?? 0)
      setLoading(false)
    } else {
      // Cache miss or date-sort bust: fresh fetch with current API orderBy
      setPage(1)
      setCards([])
      fetchCards(activeVibe, effectiveSearch, setQuery, sortBy, 1)
    }
  }, [activeVibe, effectiveSearch, setQuery, sortBy, fetchCards]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sort change: re-sort cached raw cards locally — instantaneous, no network call
  useEffect(() => {
    const key = activeKeyRef.current
    const rawCards = key ? (cacheRef.current[key]?.rawCards ?? null) : null
    if (rawCards) setCards(sortCards(rawCards, sortBy))
  }, [sortBy])

  const saveCard = useCallback(async (card, owned, quantity = 1) => {
    if (!user) return { error: new Error('Not signed in'), toast: '' }

    const normalizedQty = Math.max(1, quantity)
    const payload = {
      user_id:      user.id,
      card_id:      card.id,
      name:         card._is1stEd ? `${card.name} â­` : card.name,
      image:        card.images?.small,
      market_price: getCardPrice(card),
      mid_price:    card.mid_price ?? null,
      low_price:    card.low_price ?? null,
      owned,
    }
    if (owned) payload.quantity = normalizedQty
    if (activeBinderId) payload.binder_id = activeBinderId

    let toast = owned ? 'Added to Collection! âœ¨ðŸ“¦' : 'Added to Wishlist! ðŸ’–'

    if (owned) {
      const { data: existing, error: existingError } = await supabase
        .from('wishlists')
        .select('owned, quantity')
        .eq('user_id', user.id)
        .eq('card_id', card.id)
        .maybeSingle()

      if (existingError && existingError.code !== 'PGRST116') {
        return { error: existingError, toast: '' }
      }

      if (existing?.owned) {
        payload.quantity = (existing.quantity || 1) + normalizedQty
        toast = normalizedQty === 1
          ? 'Added another copy to Collection! âœ¨ðŸ“¦'
          : `Added ${normalizedQty} more copies to Collection! âœ¨ðŸ“¦`
      } else if (existing) {
        toast = normalizedQty === 1
          ? 'Moved to Collection! âœ¨ðŸ“¦'
          : `Moved to Collection with ${normalizedQty} copies! âœ¨ðŸ“¦`
      } else if (normalizedQty > 1) {
        toast = `Added ${normalizedQty} copies to Collection! âœ¨ðŸ“¦`
      }
    }

    const { error } = await supabase
      .from('wishlists')
      .upsert(payload, { onConflict: 'user_id,card_id' })

    return { error, toast }
  }, [user, activeBinderId])

  // Stable references so CardTile memo comparisons don't break on every render
  const quickAdd = useCallback(async (e, card, owned, quantity = 1) => {
    e.stopPropagation()
    if (!user) { onToast('Login to save cards 💖'); return }
    if (collectionIds?.has(card.id) && !owned) { onToast('Already saved! Tap the card to manage it ✅'); return }
    const { error, toast } = await saveCard(card, owned, quantity)
    /*
      user_id:      user.id,
      card_id:      card.id,
      name:         card._is1stEd ? `${card.name} ⭐` : card.name,
    if (!error) { onCardAdded?.(card.id, owned); onToast(owned ? 'Added to Collection! ✨📦' : 'Added to Wishlist! 💖') }
    */
    if (!error) { onCardAdded?.(card.id, owned); onToast(toast) }
  }, [user, collectionIds, onCardAdded, onToast, saveCard]) // eslint-disable-line react-hooks/exhaustive-deps

  const quickRemove = useCallback(async (e, card) => {
    e.stopPropagation()
    if (!user) return
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('card_id', card.id)
    if (!error) { onCardRemoved?.(card.id); onToast('Removed from Collection 🗑️') }
  }, [user, onCardRemoved, onToast]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeVibe && !setQuery && !effectiveSearch) {
    return (
      <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
        Pick a vibe above to discover cards ✨
      </p>
    )
  }

  return (
    <>
      <SearchBar
        value={inlineSearch}
        onChange={setInlineSearch}
        onClear={handleInlineClear}
      />
      <SortToolbar sortBy={sortBy} onSortChange={onSortChange} />

      <motion.div
        key={`${activeVibe}-${setQuery}-${effectiveSearch}`}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.02 } } }}
      >
        {cards.map(card => (
          <CardTile
            key={card.id}
            card={card}
            inList={collectionIds?.has(card.id) ?? false}
            isOwned={ownedIds?.has(card.id) ?? false}
            quickAdd={quickAdd}
            quickRemove={quickRemove}
            setSelected={setSelected}
          />
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

      {!loading && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onPageChange={p => {
            setPage(p)
            fetchCards(activeVibe, effectiveSearch, setQuery, sortBy, p)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      <AnimatePresence>
        {selected && (
          <CardModal card={selected} user={user} onToast={onToast} onClose={() => setSelected(null)} saveCard={saveCard} collectionIds={collectionIds} ownedIds={ownedIds} onCardAdded={onCardAdded} onCardRemoved={onCardRemoved} />
        )}
      </AnimatePresence>
    </>
  )
}

export default memo(CardGrid)
