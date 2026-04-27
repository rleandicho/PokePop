import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchCardsFromDb, refreshPriceIfStale } from '../lib/cardDb.js'
import CardSkeleton from './CardSkeleton'
import SearchBar from './SearchBar'

const PAGE_SIZE   = 20
const CACHE_LIMIT = 10   // max unique filter combinations held in memory

// ─── Sort options ─────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { id: 'oldest',    label: 'Release Date (Oldest)' },
  { id: 'newest',    label: 'Release Date (Newest)' },
  { id: 'alpha',     label: 'Alphabetical (A–Z)' },
  { id: 'price-high', label: 'Price (High → Low)' },
  { id: 'price-low',  label: 'Price (Low → High)' },
]

// Pick the best available market price across all TCGPlayer tiers.
// Used for grid display / sort — the specific version price is shown separately in the modal.
function getBestPrice(prices = {}) {
  return (
    Object.values(prices).find(v => v?.market != null)?.market ?? 0
  )
}

function getCardPrice(card) {
  if (card.market_price != null) return card.market_price
  return getBestPrice(card.tcgplayer?.prices ?? {})
}

// Human-readable labels for each TCGPlayer price tier key
const TIER_LABELS = {
  '1stEditionHolofoil': '1st Ed Holofoil',
  '1stEditionNormal':   '1st Ed Normal',
  'holofoil':           'Holofoil',
  'reverseHolofoil':    'Reverse Holofoil',
  'normal':             'Normal',
}
function tierLabel(key) {
  return TIER_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim()
}

// Cache key includes sort so each sort+filter combo has its own cache slot.
// Switching sorts never re-uses data fetched under a different sort's API ordering.
// v2: rebuilt after price-sort ordering fix (oldest-first for both price directions).
function buildCacheKey(vibe, search, setQuery, sort, engOnly) {
  return `v2|${vibe ?? ''}|${search ?? ''}|${setQuery ?? ''}|${sort ?? ''}|${engOnly ? 'en' : 'all'}`
}

// ─── localStorage card cache ──────────────────────────────────────────────────
// Persists non-price-sort results across page refreshes.
// Price sorts are skipped — too many rows for reliable localStorage storage.
// v2: card data now sourced from Supabase (different shape — invalidates v1 entries)
const LS_PREFIX = 'pokepop_cards_v3|'
const LS_TTL    = 60 * 60 * 1000  // 1 hour — card data rarely changes within a session

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > LS_TTL) { localStorage.removeItem(LS_PREFIX + key); return null }
    return data
  } catch { return null }
}

function lsSet(key, data) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {} // quota exceeded or private browsing — silently skip
}

function sortCards(cards, sort) {
  const arr = [...cards]

  if (sort === 'price-high' || sort === 'price-low') {
    const priced   = arr.filter(c => getCardPrice(c) > 0)
    const unpriced = arr.filter(c => getCardPrice(c) <= 0)
    if (sort === 'price-high') {
      priced.sort((a, b) => getCardPrice(b) - getCardPrice(a))
    } else {
      priced.sort((a, b) => getCardPrice(a) - getCardPrice(b))
    }
    return [...priced, ...unpriced]
  }

  if (sort === 'alpha') {
    return arr.sort((a, b) => a.name.localeCompare(b.name))
  }

  if (sort === 'newest') {
    return arr.sort((a, b) => {
      const da = new Date(a.set?.releaseDate || '1900/01/01')
      const db = new Date(b.set?.releaseDate || '1900/01/01')
      return db - da
    })
  }

  return arr   // 'oldest' — API already returns oldest-first, no local sort needed
}


// ─── Sub-components ───────────────────────────────────────────────────────────
function PriceTag({ card }) {
  const val = card.market_price ?? card.ebay_market
  if (!val) return null
  const isEbay = card.price_source === 'ebay'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
      ${isEbay ? 'text-amber-700 bg-amber-100' : 'text-pink-600 bg-pink-100'}`}
      title={isEbay ? 'avg. of last 10 eBay sales' : undefined}
    >
      ${Number(val).toFixed(2)}{isEbay ? ' ⊕' : ''}
    </span>
  )
}

// Shows the card number badge so multiple set printings are visually distinct.
function VariantBadges({ card }) {
  if (!card.number) return null
  return (
    <div className="flex items-center justify-center mt-0.5 mb-0.5">
      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full leading-tight">
        #{card.number}
      </span>
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

function SortToolbar({ sortBy, onSortChange, engOnly, onEngOnlyToggle }) {
  return (
    <div className="flex justify-between items-center flex-wrap px-4 pt-2 pb-1 gap-2">
      {/* Left — language filter */}
      <button
        onClick={onEngOnlyToggle}
        title={engOnly ? 'Showing English only — click to show all languages' : 'Show English cards only'}
        className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all shadow-sm
          ${engOnly
            ? 'bg-sky-400 text-white border-sky-400'
            : 'bg-white/70 text-gray-400 border-gray-200 hover:bg-white/90 hover:text-sky-500 hover:border-sky-300'
          }`}
      >
        🇺🇸 ENG
      </button>

      {/* Right — sort */}
      <div className="flex items-center gap-2">
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
    </div>
  )
}

const LANG_OPTIONS = [
  { value: 'english',    label: 'English',               flag: '🇺🇸' },
  { value: 'japanese',   label: 'Japanese',              flag: '🇯🇵' },
  { value: 'korean',     label: 'Korean',                flag: '🇰🇷' },
  { value: 'chinese_t',  label: 'Chinese (Traditional)', flag: '🇹🇼' },
  { value: 'chinese_s',  label: 'Chinese (Simplified)',  flag: '🇨🇳' },
  { value: 'french',     label: 'French',                flag: '🇫🇷' },
  { value: 'german',     label: 'German',                flag: '🇩🇪' },
  { value: 'italian',    label: 'Italian',               flag: '🇮🇹' },
  { value: 'spanish',    label: 'Spanish',               flag: '🇪🇸' },
  { value: 'portuguese', label: 'Portuguese',            flag: '🇧🇷' },
  { value: 'thai',       label: 'Thai',                  flag: '🇹🇭' },
  { value: 'indonesian', label: 'Indonesian',            flag: '🇮🇩' },
  { value: 'russian',    label: 'Russian',               flag: '🇷🇺' },
]

function CardModal({ card, user, onToast, onClose, saveCard, collectionIds, ownedIds, collectionLanguages, onCardAdded, onCardRemoved }) {
  const [saving,      setSaving]      = useState(false)
  const [removing,    setRemoving]    = useState(false)
  const [quantity,    setQuantity]    = useState(1)
  const [imgSrc,      setImgSrc]      = useState(card.images?.small)
  const [addLangMode,  setAddLangMode]  = useState(false)
  const [newLang,      setNewLang]      = useState('')
  const [newLangImage, setNewLangImage] = useState('')

  useEffect(() => {
    if (!card.images?.large || card.images.large === card.images.small) return
    const img = new Image()
    img.onload = () => setImgSrc(card.images.large)
    img.src = card.images.large
  }, [card.images?.large]) // eslint-disable-line react-hooks/exhaustive-deps

  const prices     = card.tcgplayer?.prices ?? {}
  // All tiers that have a market price — shown in the breakdown and drive the version picker
  const priceRows  = Object.entries(prices).filter(([, v]) => v?.market != null)
  const inList  = collectionIds?.has(card.id)
  const isOwned = ownedIds?.has(card.id)
  const myLangs = collectionLanguages?.get(card.id) ?? []

  // Version picker: default to whichever tier has the best market price
  const defaultVersion = priceRows.length > 0 ? priceRows[0][0] : ''
  const [version, setVersion] = useState(defaultVersion)

  async function addCard(owned, qty = 1, language = 'english') {
    if (!user) return
    setSaving(true)
    const { error, toast } = await saveCard(card, owned, qty, version, language)
    setSaving(false)
    if (!error) {
      onCardAdded?.(card.id, owned, language)
      onToast(owned ? 'Added to Collection! ✨📦' : 'Added to Wishlist! 💖')
    }
  }

  async function addLanguageVariant() {
    if (!newLang) { onToast('Pick a language first'); return }
    if (myLangs.includes(newLang)) { onToast('You already have that language saved!'); return }
    setSaving(true)
    // Image priority: user-provided URL > JP image from DB > English fallback
    let langCard = card
    const customImg = newLangImage.trim()
    if (customImg) {
      langCard = { ...card, images: { small: customImg, large: customImg } }
    } else if (newLang === 'japanese') {
      const { data: cardRow } = await supabase
        .from('tcg_cards')
        .select('jp_image_small, jp_image_large')
        .eq('id', card.id)
        .maybeSingle()
      if (cardRow?.jp_image_small) {
        langCard = {
          ...card,
          images: { small: cardRow.jp_image_small, large: cardRow.jp_image_large ?? cardRow.jp_image_small },
        }
      }
    }
    const { error, toast } = await saveCard(langCard, true, 1, version, newLang)
    setSaving(false)
    if (!error) {
      onCardAdded?.(card.id, true, newLang)
      onToast(toast ?? 'Language variant added! ✨')
      setAddLangMode(false)
      setNewLang('')
      setNewLangImage('')
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
    if (!error) { onCardRemoved?.(card.id, null); onToast(isOwned ? 'Removed from Collection 🗑️' : 'Removed from Wishlist 🗑️') }
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

        {/* ── eBay average price (cards not on TCGPlayer) ── */}
        {card.price_source === 'ebay' && card.ebay_market != null && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-amber-100 bg-amber-50">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-2.5">
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                  Market Price
                </p>
                <p className="text-[10px] text-amber-500 normal-case">
                  avg. of last 10 eBay sales
                </p>
              </div>
              <span className="text-xl font-bold text-amber-700">
                ${Number(card.ebay_market).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* ── Price tiers — tap a row to select the version when saving ── */}
        {priceRows.length > 0 && (
          <div className="mb-3 rounded-2xl overflow-hidden border border-pink-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">
              {card.rarity ? `${card.rarity} · ` : ''}TCGPlayer Prices
              {user && <span className="ml-1 text-pink-400 normal-case font-normal">(tap to select version)</span>}
            </p>
            {priceRows.map(([key, p]) => {
              const selected = version === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => user ? setVersion(key) : undefined}
                  className={`w-full flex justify-between items-center px-3 py-2 text-sm transition-colors
                    ${selected && user ? 'bg-pink-100 border-l-2 border-pink-400' : 'bg-white hover:bg-pink-50/60'}`}
                >
                  <span className={`font-medium ${selected && user ? 'text-pink-600' : 'text-gray-600'}`}>
                    {tierLabel(key)}
                  </span>
                  <div className="flex gap-3 text-right items-center">
                    {p.market != null && (
                      <span className={`font-bold ${selected && user ? 'text-pink-500' : 'text-gray-700'}`}>
                        ${p.market.toFixed(2)}
                      </span>
                    )}
                    {p.mid != null && <span className="text-[11px] text-gray-400">mid ${p.mid.toFixed(2)}</span>}
                    {p.low != null && <span className="text-[11px] text-gray-400">low ${p.low.toFixed(2)}</span>}
                    {selected && user && <span className="text-pink-400 text-xs">✓</span>}
                  </div>
                </button>
              )
            })}
            {user && (
              <button
                type="button"
                onClick={() => setVersion('')}
                className={`w-full text-left px-3 py-2 text-sm transition-colors
                  ${!version ? 'bg-pink-100 border-l-2 border-pink-400 text-pink-600 font-medium' : 'bg-white hover:bg-pink-50/60 text-gray-400'}`}
              >
                Unspecified {!version && <span className="text-pink-400 text-xs ml-1">✓</span>}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {user ? (
            <>
              {/* Owned language variants */}
              {myLangs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 justify-center py-1">
                  {myLangs.map(lang => {
                    const opt = LANG_OPTIONS.find(o => o.value === lang)
                    return (
                      <span key={lang}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                   bg-pink-50 border border-pink-200 text-pink-600 text-xs font-medium"
                      >
                        {opt?.flag ?? '🌐'} {opt?.label ?? lang}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Status note when card is already saved in any edition */}
              {inList && (
                <p className="text-center text-xs font-semibold text-gray-400">
                  {isOwned ? '✅ In your Collection' : '💖 In your Wishlist'}
                  {version && <span className="ml-1 text-pink-400 font-normal">· Adding as {tierLabel(version) ?? 'Unspecified'}</span>}
                </p>
              )}

              {/* Add language variant panel */}
              {addLangMode ? (
                <div className="flex flex-col gap-2 p-3 bg-violet-50 rounded-2xl border border-violet-200">
                  <p className="text-xs font-semibold text-violet-600">Add language variant</p>
                  <select
                    value={newLang}
                    onChange={e => setNewLang(e.target.value)}
                    className="text-sm border border-violet-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
                  >
                    <option value="">Select language…</option>
                    {LANG_OPTIONS.filter(o => !myLangs.includes(o.value)).map(o => (
                      <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={newLangImage}
                    onChange={e => setNewLangImage(e.target.value)}
                    placeholder="Card image URL (optional)"
                    className="text-sm border border-violet-200 rounded-xl px-3 py-1.5
                               focus:outline-none focus:border-violet-400 bg-white
                               placeholder:text-gray-300"
                  />
                  <p className="text-[10px] text-violet-400 -mt-1">
                    Paste a card image URL to show the foreign print. Leave blank to use the English art with a language flag.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAddLangMode(false); setNewLang(''); setNewLangImage('') }}
                      className="flex-1 border border-gray-200 text-gray-400 hover:bg-gray-50
                                 font-semibold py-1.5 rounded-xl text-sm transition-colors"
                    >Cancel</button>
                    <button
                      onClick={addLanguageVariant}
                      disabled={saving || !newLang}
                      className="flex-1 bg-violet-400 hover:bg-violet-500 text-white
                                 font-semibold py-1.5 rounded-xl text-sm transition-colors disabled:opacity-60"
                    >{saving ? '…' : 'Add'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <QuantityStepper value={quantity} onChange={setQuantity} />
                  <div className="flex gap-2">
                    {!inList && (
                      <button
                        onClick={() => addCard(false)}
                        disabled={saving}
                        className="flex-1 bg-violet-100 hover:bg-violet-200 text-violet-700
                                   font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                      >
                        {saving ? '…' : '💖 Wishlist'}
                      </button>
                    )}
                    <button
                      onClick={() => addCard(true, quantity)}
                      disabled={saving}
                      className="flex-1 bg-emerald-400 hover:bg-emerald-500 text-white
                                 font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                    >
                      {saving ? 'Saving…' : inList && isOwned ? `+ Add ${quantity} Cop${quantity === 1 ? 'y' : 'ies'}` : inList ? `Move to Collection ×${quantity}` : '✨ Collection'}
                    </button>
                  </div>
                  {inList && (
                    <button
                      onClick={() => setAddLangMode(true)}
                      className="border border-violet-200 text-violet-500 hover:bg-violet-50
                                 font-semibold py-2 rounded-2xl transition-colors text-sm"
                    >
                      🌐 Add language variant
                    </button>
                  )}
                </>
              )}

              {inList && (
                <button
                  onClick={removeCard}
                  disabled={removing}
                  className="border border-red-300 text-red-500 hover:bg-red-50
                             font-semibold py-2 rounded-2xl transition-colors disabled:opacity-60"
                >
                  {removing ? 'Removing…' : '🗑️ Remove all saved copies'}
                </button>
              )}
            </>
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
const LANG_FLAG_MAP = { japanese:'🇯🇵', korean:'🇰🇷', chinese_t:'🇹🇼', chinese_s:'🇨🇳', french:'🇫🇷', german:'🇩🇪', italian:'🇮🇹', spanish:'🇪🇸', portuguese:'🇧🇷', thai:'🇹🇭', indonesian:'🇮🇩', russian:'🇷🇺' }

const CardTile = memo(function CardTile({ card, inList, isOwned, myLangs, quickAdd, quickRemove, setSelected }) {
  const [ownedQty, setOwnedQty] = useState(1)

  return (
    <motion.div
      className={`cursor-pointer rounded-2xl overflow-hidden shadow-md relative ${
        isOwned ? 'tile-owned' : inList ? 'tile-wishlist' : 'tile-default'
      }`}
      style={{
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
      {/* Language variant flags — shown when the card is saved in multiple languages */}
      {myLangs && myLangs.length > 1 && (
        <div className="absolute top-6 left-1.5 z-10 flex flex-col gap-0.5">
          {myLangs.filter(l => l !== 'english').map(lang => (
            <span key={lang} className="text-[11px] leading-none drop-shadow-sm"
                  title={lang}>{LANG_FLAG_MAP[lang]}</span>
          ))}
        </div>
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
      {card.card_language && card.card_language !== 'en' && (
        <span className="absolute bottom-1.5 left-1.5 z-10 text-[10px] font-bold
                         px-1.5 py-0.5 rounded-full bg-sky-500/90 text-white shadow-sm leading-tight">
          {{ zh:'🇨🇳 ZH', ja:'🇯🇵 JA', ko:'🇰🇷 KO', fr:'🇫🇷 FR', de:'🇩🇪 DE' }[card.card_language] ?? card.card_language.toUpperCase()}
        </span>
      )}
      <img src={card.images?.small} alt={card.name} className="w-full" loading="lazy" />
      <div className="p-2 text-center">
        <p className="text-sm font-bold text-gray-700 truncate">{card.name}</p>
        {card.card_language && card.card_language !== 'en' && card.english_name && (
          <p className="text-[10px] text-sky-500 truncate font-medium">{card.english_name}</p>
        )}
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
        {inList && !isOwned && (
          <button
            onClick={e => quickAdd(e, card, true, 1)}
            className="w-full mt-1 text-[10px] font-semibold py-1 rounded-xl
                       bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
            title="Move to Collection"
          >
            ✅ Move to Collection
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
function CardGrid({ activeVibe, search, setQuery, sortBy, onSortChange, user, onToast, activeBinderId, collectionIds, ownedIds, collectionLanguages, onCardAdded, onCardRemoved }) {
  const gridTopRef   = useRef(null)
  const [cards,      setCards]      = useState([])
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  // Start as true when a filter is already active so skeletons show on the very first paint
  const [loading,  setLoading]  = useState(() => !!(activeVibe || setQuery || search))
  const [dbError,  setDbError]  = useState(null)   // set when card DB isn't ready yet
  const [selected, setSelected] = useState(null)
  const [engOnly,  setEngOnly]  = useState(false)  // when true, hides non-English cards

  // Lazy price refresh — fires when a card modal opens.
  // Silently fetches a fresh price from pokemontcg.io if the stored price is > 24h old,
  // then upserts to tcg_prices. Does not block or affect the modal's current display.
  useEffect(() => {
    if (!selected) return
    refreshPriceIfStale(selected.id, import.meta.env.VITE_TCG_API_KEY)
  }, [selected?.id])  // eslint-disable-line react-hooks/exhaustive-deps

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

  const fetchCards = useCallback(async (vibe, srch, sq, sort, pg, engOnlyFlag) => {
    const key = buildCacheKey(vibe, srch, sq, sort, engOnlyFlag)
    activeKeyRef.current = key

    // Abort any previous Supabase fetch (bumping reqId is how we discard stale responses)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // Stamp this request so we can discard responses that arrive out of order
    const reqId = ++reqIdRef.current

    setLoading(true)

    const isPriceSort = sort === 'price-high' || sort === 'price-low'

    try {
      const { cards: rawCards, totalPages: total } = await fetchCardsFromDb({
        vibe: vibe !== 'all' ? vibe : null,
        search: srch,
        setQuery: sq,
        sort,
        page: pg,
        engOnly: engOnlyFlag,
      })

      // A newer request has already started — discard this response
      if (reqIdRef.current !== reqId) return

      // Write to LRU in-memory cache
      const keyList = cacheKeysRef.current
      const existing = keyList.indexOf(key)
      if (existing !== -1) keyList.splice(existing, 1)
      if (keyList.length >= CACHE_LIMIT) {
        const evicted = keyList.shift()
        delete cacheRef.current[evicted]
      }
      keyList.push(key)
      cacheRef.current[key] = { rawCards, page: pg, totalPages: total }

      // Persist to localStorage so the next page load skips the network (non-price sorts only)
      if (!isPriceSort) lsSet(key, { rawCards, totalPages: total })

      setCards(sortCards(rawCards, sort))
      setTotalPages(total)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('fetchCards:', err)
      // Surface a human-readable error when the DB tables haven't been created yet
      if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
        setDbError('Card database is being set up — check back soon! 🛠️')
      }
      setTotalPages(0)
    }

    // Only clear loading if this is still the active request
    if (reqIdRef.current === reqId) setLoading(false)
  }, [])

  // Filter or sort change: serve from cache or fetch fresh.
  // Sort is part of the cache key so switching sorts never re-uses another sort's data.
  useEffect(() => {
    const hasFilter = activeVibe || setQuery || effectiveSearch
    if (!hasFilter) return

    const key = buildCacheKey(activeVibe, effectiveSearch, setQuery, sortBy, engOnly)
    activeKeyRef.current = key

    // Cancel any in-flight request when filter/sort changes.
    abortRef.current?.abort()
    reqIdRef.current++

    const cached = cacheRef.current[key]

    if (cached) {
      // Cache hit: serve immediately, no network request
      setCards(sortCards(cached.rawCards, sortBy))
      setPage(1)
      setTotalPages(cached.totalPages ?? 0)
      setLoading(false)
    } else {
      // Check localStorage before hitting the network (non-price sorts only)
      const isPriceSortNow = sortBy === 'price-high' || sortBy === 'price-low'
      const lsCached = !isPriceSortNow ? lsGet(key) : null
      if (lsCached) {
        // Warm the in-memory cache from localStorage so subsequent filter switches are instant
        const keyList = cacheKeysRef.current
        if (!keyList.includes(key)) {
          if (keyList.length >= CACHE_LIMIT) { const evicted = keyList.shift(); delete cacheRef.current[evicted] }
          keyList.push(key)
        }
        cacheRef.current[key] = { rawCards: lsCached.rawCards, page: 1, totalPages: lsCached.totalPages }
        setCards(sortCards(lsCached.rawCards, sortBy))
        setPage(1)
        setTotalPages(lsCached.totalPages ?? 0)
        setLoading(false)
      } else {
        // Full cache miss: fresh fetch with the correct API ordering for this sort
        setPage(1)
        setCards([])
        fetchCards(activeVibe, effectiveSearch, setQuery, sortBy, 1, engOnly)
      }
    }
  }, [activeVibe, effectiveSearch, setQuery, sortBy, engOnly, fetchCards]) // eslint-disable-line react-hooks/exhaustive-deps


  const saveCard = useCallback(async (card, owned, quantity = 1, edition = '', language = 'english') => {
    if (!user) return { error: new Error('Not signed in'), toast: '' }

    const normalizedQty = Math.max(1, quantity)
    const payload = {
      user_id:      user.id,
      card_id:      card.id,
      name:         card.name,
      image:        card.images?.small,
      market_price: edition ? (card.tcgplayer?.prices?.[edition]?.market ?? getCardPrice(card)) : getCardPrice(card),
      mid_price:    edition ? (card.tcgplayer?.prices?.[edition]?.mid    ?? card.mid_price ?? null) : (card.mid_price ?? null),
      low_price:    edition ? (card.tcgplayer?.prices?.[edition]?.low    ?? card.low_price ?? null) : (card.low_price ?? null),
      owned,
      edition:      edition || 'unspecified',
      language:     language || 'english',
    }
    if (owned) payload.quantity = normalizedQty

    let toast = owned ? 'Added to Collection! ✨📦' : 'Added to Wishlist! 💖'

    if (owned) {
      const { data: existing, error: existingError } = await supabase
        .from('wishlists')
        .select('owned, quantity')
        .eq('user_id', user.id)
        .eq('card_id', card.id)
        .eq('language', language || 'english')
        .maybeSingle()

      if (existingError && existingError.code !== 'PGRST116') {
        return { error: existingError, toast: '' }
      }

      if (existing?.owned) {
        payload.quantity = (existing.quantity || 1) + normalizedQty
        toast = normalizedQty === 1
          ? 'Added another copy to Collection! ✨📦'
          : `Added ${normalizedQty} more copies to Collection! ✨📦`
      } else if (existing) {
        toast = normalizedQty === 1
          ? 'Moved to Collection! ✨📦'
          : `Moved to Collection with ${normalizedQty} copies! ✨📦`
      } else if (normalizedQty > 1) {
        toast = `Added ${normalizedQty} copies to Collection! ✨📦`
      }
    }

    const { error } = await supabase
      .from('wishlists')
      .upsert(payload, { onConflict: 'user_id,card_id,edition,language' })

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
      name:         card.name,
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

  if (dbError) {
    return (
      <p className="text-center text-amber-500 font-semibold mt-16 text-base max-w-sm mx-auto">
        {dbError}
      </p>
    )
  }

  return (
    <>
      <div ref={gridTopRef} />
      <SearchBar
        value={inlineSearch}
        onChange={setInlineSearch}
        onClear={handleInlineClear}
      />
      <SortToolbar
        sortBy={sortBy}
        onSortChange={onSortChange}
        engOnly={engOnly}
        onEngOnlyToggle={() => setEngOnly(v => !v)}
      />

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
            myLangs={collectionLanguages?.get(card.id)}
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
            fetchCards(activeVibe, effectiveSearch, setQuery, sortBy, p, engOnly)
            gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}

      <AnimatePresence>
        {selected && (
          <CardModal card={selected} user={user} onToast={onToast} onClose={() => setSelected(null)} saveCard={saveCard} collectionIds={collectionIds} ownedIds={ownedIds} collectionLanguages={collectionLanguages} onCardAdded={onCardAdded} onCardRemoved={onCardRemoved} />
        )}
      </AnimatePresence>
    </>
  )
}

export default memo(CardGrid)
