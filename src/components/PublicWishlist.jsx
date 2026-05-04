import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

const CARD_BACK = 'https://images.pokemontcg.io/cardback.jpg'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import { getStoredTheme, applyTheme } from '../lib/theme'
import BinderView from './BinderView'
import ThemeToggle from './ThemeToggle'

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

// ─── Pagination constant ──────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 20

// ─── Three showcase panels side-by-side ──────────────────────────────────────
function ShowcasePanels({ items, onCardClick }) {
  const price = i => i.manual_price || i.market_price || i.mid_price || i.low_price || 0
  const owned  = items.filter(i => i.owned)

  const top3      = [...owned].filter(i => price(i) > 0).sort((a, b) => price(b) - price(a)).slice(0, 3)
  const chaseCards    = items.filter(i => i.is_chase)
  const favoriteCards = owned.filter(i => i.is_favorite)

  if (!top3.length && !chaseCards.length && !favoriteCards.length) return null

  return (
    <div className="max-w-2xl mx-auto px-4 pb-4 flex gap-3">
      {top3.length > 0 && (
        <div className="flex-1 min-w-0 p-3 rounded-2xl border border-yellow-200 bg-gradient-to-b from-yellow-50 to-amber-50 shadow-sm">
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-2">👑 High-Rollers</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {top3.map((item, i) => (
              <motion.div key={item.card_id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.08 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onCardClick?.(item)}>
                <div className="relative">
                  {i === 0 && <span className="absolute -top-2 -right-2 text-sm z-10">👑</span>}
                  <img src={item.image} alt={item.name} className="w-12 rounded-xl shadow-md border-2 border-yellow-300" onError={e => { e.currentTarget.src = CARD_BACK }} />
                </div>
                <p className="text-[10px] font-bold text-gray-600 text-center w-12 truncate">{item.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {chaseCards.length > 0 && (
        <div className="flex-1 min-w-0 p-3 rounded-2xl border border-pink-200 bg-gradient-to-b from-pink-50 to-rose-50 shadow-sm">
          <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wide mb-2">🎯 Chase Cards</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {chaseCards.map((item, i) => (
              <motion.div key={item.card_id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.08 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onCardClick?.(item)}>
                <img src={item.image} alt={item.name} className="w-12 rounded-xl shadow-md border-2 border-pink-300" onError={e => { e.currentTarget.src = CARD_BACK }} />
                <p className="text-[10px] font-bold text-gray-600 text-center w-12 truncate">{item.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {favoriteCards.length > 0 && (
        <div className="flex-1 min-w-0 p-3 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-violet-50 shadow-sm">
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-2">⭐ Favourites</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {favoriteCards.map((item, i) => (
              <motion.div key={item.card_id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.08 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onCardClick?.(item)}>
                <img src={item.image} alt={item.name} className="w-12 rounded-xl shadow-md border-2 border-indigo-300" onError={e => { e.currentTarget.src = CARD_BACK }} />
                <p className="text-[10px] font-bold text-gray-600 text-center w-12 truncate">{item.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PublicWishlist() {
  const { userId } = useParams()

  const [profile,        setProfile]        = useState(null)
  const [items,          setItems]          = useState([])
  const [activeTab,      setActiveTab]      = useState('collection')
  const [status,         setStatus]         = useState('loading')  // 'loading'|'private'|'notfound'|'ready'

  // Viewer state (who is currently browsing)
  const [viewer,         setViewer]         = useState(null)
  const [isFollowing,    setIsFollowing]    = useState(false)
  const [followBusy,     setFollowBusy]     = useState(false)

  // Viewer's own collection for comparison
  const [viewerOwnedIds,    setViewerOwnedIds]    = useState(new Set())
  const [viewerWishlistIds, setViewerWishlistIds] = useState(new Set())
  const [savingCardId,      setSavingCardId]      = useState(null)
  const [miniToast,         setMiniToast]         = useState('')
  const [selectedShowcaseItem, setSelectedShowcaseItem] = useState(null)

  // Binder navigation
  const [binders,        setBinders]        = useState([])
  const [selectedBinder, setSelectedBinder] = useState(null)

  // Shop mode: filter collection to cards with a TCGPlayer price
  const [shopMode,       setShopMode]       = useState(false)

  // Pagination
  const [collectionPage, setCollectionPage] = useState(1)
  const [wishlistPage,   setWishlistPage]   = useState(1)
  const [themeMode,      setThemeMode]      = useState(() => getStoredTheme())

  useEffect(() => { applyTheme(themeMode) }, [themeMode])

  useEffect(() => {
    async function load() {
      // Fetch session + target profile in parallel
      const [{ data: { session } }, { data: prof }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('profiles')
          .select('id, username, is_public')
          .eq('id', userId)
          .maybeSingle(),
      ])

      const currentUser = session?.user ?? null
      setViewer(currentUser)

      if (!prof)           { setStatus('notfound'); return }
      if (!prof.is_public) { setStatus('private');  return }

      setProfile(prof)

      const checkFollow = currentUser && currentUser.id !== userId
      const queries = [
        fetchAllRows(() =>
          supabase
            .from('wishlists')
            .select('card_id, name, image, owned, market_price, mid_price, low_price, manual_price, slot_index, binder_id, is_chase, is_favorite, quantity, created_at, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        ),
        supabase
          .from('binders')
          .select('id, name, color, page_style')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ]

      if (checkFollow) {
        queries.push(
          supabase
            .from('follows')
            .select('id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId)
            .maybeSingle()
        )
      }

      // Fetch viewer's own collection for comparison (only if logged in and viewing someone else)
      if (checkFollow) {
        queries.push(
          fetchAllRows(() =>
            supabase
              .from('wishlists')
              .select('card_id, owned')
              .eq('user_id', currentUser.id)
          )
        )
      }

      const [wishlistRaw, { data: binderData }, followResult, viewerCollection] = await Promise.all(queries)
      setItems(wishlistRaw ?? [])

      if (viewerCollection) {
        setViewerOwnedIds(new Set(viewerCollection.filter(r => r.owned).map(r => r.card_id)))
        setViewerWishlistIds(new Set(viewerCollection.filter(r => !r.owned).map(r => r.card_id)))
      }

      const loadedBinders = binderData ?? []
      setBinders(loadedBinders)
      setSelectedBinder(loadedBinders[0] ?? null)

      if (checkFollow) setIsFollowing(!!followResult?.data)

      setStatus('ready')
    }
    load()
  }, [userId])

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  async function toggleFollow() {
    if (!viewer || followBusy) return
    const next = !isFollowing
    setIsFollowing(next)       // optimistic
    setFollowBusy(true)

    if (next) {
      const { error } = await supabase
        .from('follows')
        .upsert(
          { follower_id: viewer.id, following_id: userId },
          { onConflict: 'follower_id,following_id' }
        )
      if (error) setIsFollowing(false)
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', viewer.id)
        .eq('following_id', userId)
      if (error) setIsFollowing(true)
    }
    setFollowBusy(false)
  }

  // ── Add a card from someone's collection/wishlist to my own wishlist ────
  async function addToMyWishlist(item, asOwned = false) {
    if (!viewer) return
    setSavingCardId(item.card_id)

    // Check-then-insert: the unique constraint is (user_id, card_id, edition, language)
    // so we check first to avoid silent upsert failures from column mismatch
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', viewer.id)
      .eq('card_id', item.card_id)
      .eq('edition', 'unspecified')
      .eq('language', 'english')
      .maybeSingle()

    let error = null
    if (!existing) {
      const { error: insertError } = await supabase
        .from('wishlists')
        .insert({
          user_id:      viewer.id,
          card_id:      item.card_id,
          name:         item.name,
          image:        item.image,
          owned:        asOwned,
          market_price: item.market_price ?? 0,
          mid_price:    item.mid_price    ?? 0,
          low_price:    item.low_price    ?? 0,
          edition:      'unspecified',
          language:     'english',
        })
      error = insertError
    } else if (asOwned) {
      // Card already on wishlist — just update owned flag
      const { error: updateError } = await supabase
        .from('wishlists')
        .update({ owned: true })
        .eq('id', existing.id)
      error = updateError
    }

    setSavingCardId(null)
    if (!error) {
      if (asOwned) {
        setViewerOwnedIds(prev => new Set([...prev, item.card_id]))
        setViewerWishlistIds(prev => { const n = new Set(prev); n.delete(item.card_id); return n })
      } else {
        setViewerWishlistIds(prev => new Set([...prev, item.card_id]))
      }
      setMiniToast(asOwned ? 'Added to your Collection! ✨' : 'Added to your Wishlist! 💖')
      setTimeout(() => setMiniToast(''), 2500)
    }
  }

  // ── Shared shell ──────────────────────────────────────────────────────────
  function Shell({ children }) {
    return (
      <div className={`theme-shell ${themeMode === 'dark' ? 'dark-theme' : ''}`}>
        {children}
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            className="w-10 h-10 rounded-full border-4 border-pink-300 border-t-pink-500"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          />
        </div>
      </Shell>
    )
  }

  if (status === 'private' || status === 'notfound') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <p className="text-6xl">{status === 'notfound' ? '🔍' : '🔒'}</p>
          <p className="text-xl font-bold text-pink-500 text-center">
            {status === 'notfound' ? 'Trainer not found' : "This trainer's collection is private"}
          </p>
          <p className="text-sm text-gray-400 text-center">
            {status === 'notfound'
              ? 'That share link may be outdated or incorrect.'
              : 'Ask them to make their collection public to share it!'}
          </p>
          <Link
            to="/"
            className="mt-2 inline-flex items-center gap-1.5 bg-white/60 hover:bg-pink-100
                       text-pink-500 font-semibold text-sm px-4 py-2 rounded-full
                       border border-pink-200 shadow-sm transition-all"
          >
            ← Return to Poképop
          </Link>
        </div>
      </Shell>
    )
  }

  // ── Price fallback: manual → market → mid → low → 0 ─────────────────────────
  function getDisplayPrice(item) {
    return item.manual_price || item.market_price || item.mid_price || item.low_price || 0
  }
  // Returns { value, label, isManual } so CardTile can show price source hints
  function getPriceInfo(item) {
    if (item.manual_price) return { value: item.manual_price, label: '',    isManual: true  }
    if (item.market_price) return { value: item.market_price, label: '',    isManual: false }
    if (item.mid_price)    return { value: item.mid_price,    label: 'Mid', isManual: false }
    if (item.low_price)    return { value: item.low_price,    label: 'Low', isManual: false }
    return { value: 0, label: '', isManual: false }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const collectionItems   = items.filter(i => i.owned)
  const wishlistItems     = items.filter(i => !i.owned)
  const collectionValue   = collectionItems.reduce((s, i) => s + getDisplayPrice(i) * (i.quantity || 1), 0)
  const wishlistValue     = wishlistItems.reduce((s, i) => s + getDisplayPrice(i), 0)
  const isOwnProfile      = viewer?.id === userId
  const canFollow         = viewer && !isOwnProfile

  const visibleCollection = shopMode
    ? collectionItems.filter(i => getDisplayPrice(i) > 0)
    : collectionItems

  // ── Card tile ─────────────────────────────────────────────────────────────
  function CardTile({ item }) {
    const iViewerOwned    = viewerOwnedIds.has(item.card_id)
    const iViewerWishlist = !iViewerOwned && viewerWishlistIds.has(item.card_id)
    const isSaving        = savingCardId === item.card_id
    const canAdd          = viewer && !isOwnProfile && !iViewerOwned && !iViewerWishlist

    const tileBg     = themeMode === 'dark'
      ? (item.owned ? 'bg-emerald-900/40 border-emerald-700/50' : 'bg-violet-900/40 border-violet-700/50')
      : (item.owned ? 'bg-emerald-50/95 border-emerald-200'     : 'bg-violet-50/92 border-violet-200')

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl overflow-hidden shadow-md flex flex-col border ${tileBg} cursor-pointer`}
        onClick={() => setSelectedShowcaseItem(item)}
      >
        <div className="relative">
          <img src={item.image} alt={item.name} className="w-full" loading="lazy"
               onError={e => { e.currentTarget.src = CARD_BACK }} />
          {item.owned && (item.quantity || 1) > 1 && (
            <span className="absolute bottom-1.5 right-1.5 text-[11px] font-bold bg-emerald-500 text-white
                             px-1.5 py-0.5 rounded-full shadow leading-none">
              ×{item.quantity}
            </span>
          )}
          {/* Viewer comparison badge */}
          {iViewerOwned && (
            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-emerald-500/90 text-white
                             px-1.5 py-0.5 rounded-full shadow-sm leading-none">✅ I own this</span>
          )}
          {iViewerWishlist && (
            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-violet-500/90 text-white
                             px-1.5 py-0.5 rounded-full shadow-sm leading-none">💖 My wishlist</span>
          )}
        </div>
        <div className="p-2 text-center flex flex-col flex-1">
          <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
          {(() => {
            const { value: p, label, isManual } = getPriceInfo(item)
            return p > 0 ? (
              <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${isManual ? 'text-violet-600 bg-violet-100' : 'text-pink-600 bg-pink-100'}`}>
                  ${p.toFixed(2)}{label ? ` (${label})` : ''}
                </span>
                {isManual && (
                  <span className="text-[9px] font-semibold text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full leading-none">
                    ✏️ Custom
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs font-medium text-gray-300 bg-gray-100 px-2 py-0.5
                             rounded-full inline-block mb-1 mx-auto">---</p>
            )
          })()}
          {item.owned && (
            <span className="block text-xs text-emerald-600 font-semibold mt-0.5">✅ Owned</span>
          )}
          {/* Add to my collection/wishlist buttons */}
          {canAdd && (
            <div className="mt-auto pt-2 flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => addToMyWishlist(item, false)}
                disabled={isSaving}
                className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                           bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? '…' : '💖 Want'}
              </button>
              <button
                onClick={() => addToMyWishlist(item, true)}
                disabled={isSaving}
                className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                           bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? '…' : '✅ Have'}
              </button>
            </div>
          )}
          {shopMode && item.owned && (
            <a
              href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(item.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="mt-auto pt-2 block w-full text-xs font-bold text-white
                         py-1.5 rounded-xl transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0070f3, #00a8cc)' }}
            >
              🛒 Buy on TCGPlayer
            </a>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <Shell>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="text-center pt-8 pb-4 px-4 space-y-3">
        <div className="flex justify-center">
          <ThemeToggle
            mode={themeMode}
            onToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
          />
        </div>
        <Link
          to={viewer ? '/?view=collection' : '/'}
          className="inline-flex items-center gap-1.5 bg-white/60 hover:bg-pink-100
                     text-pink-500 font-semibold text-sm px-4 py-2 rounded-full
                     border border-pink-200 shadow-sm transition-all"
        >
          ← Return to Poképop
          <span
            className={`theme-ball ${themeMode === 'dark' ? 'luxury-ball' : 'love-ball'}`}
            style={{ width: '1em', height: '1em', flexShrink: 0, display: 'inline-block' }}
          >
            <span className="theme-ball__top" />
            <span className="theme-ball__band" />
            <span className="theme-ball__button" />
            <span className="theme-ball__mark">{themeMode === 'dark' ? 'L' : '♥'}</span>
          </span>
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-pink-500 drop-shadow-sm">
          {profile.username ? `${profile.username}'s Collection` : 'Trainer Collection'}
        </h1>

        {/* Follow button — only for logged-in viewers looking at someone else's page */}
        {canFollow && (
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
              onClick={toggleFollow}
              disabled={followBusy}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-full
                         shadow-sm border transition-all disabled:opacity-60
                         ${isFollowing
                           ? 'bg-pink-100 text-pink-500 border-pink-300 hover:bg-pink-200'
                           : 'bg-pink-400 text-white border-pink-400 hover:bg-pink-500'
                         }`}
            >
              {isFollowing ? '✓ Following' : 'Follow Trainer ✨'}
            </motion.button>
          </div>
        )}
      </header>

      {/* ── Mini toast ─────────────────────────────────────────────────────── */}
      {miniToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
                        bg-pink-500 text-white text-sm font-semibold
                        px-5 py-2.5 rounded-full shadow-lg pointer-events-none">
          {miniToast}
        </div>
      )}

      {/* ── Split stats: collection (emerald) + wishlist (violet) ────────────── */}
      <div className="max-w-md mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-4 text-center border
            ${themeMode === 'dark' ? 'bg-emerald-900/40 border-emerald-700/50' : 'bg-emerald-50/95 border-emerald-200'}`}>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">
              Collection Value
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              ${collectionValue.toFixed(2)}
            </p>
            <p className="text-xs text-emerald-400 mt-0.5">
              {collectionItems.length} card{collectionItems.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className={`rounded-2xl p-4 text-center border
            ${themeMode === 'dark' ? 'bg-violet-900/40 border-violet-700/50' : 'bg-violet-50/92 border-violet-200'}`}>
            <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">
              Wishlist Value
            </p>
            <p className="text-2xl font-bold text-violet-600">
              ${wishlistValue.toFixed(2)}
            </p>
            <p className="text-xs text-violet-400 mt-0.5">
              {wishlistItems.length} card{wishlistItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Showcase panels (High-Rollers · Chase · Favourites) ────────────── */}
      <ShowcasePanels items={items} onCardClick={setSelectedShowcaseItem} />

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 px-4 pt-1 pb-3 flex-wrap">
        {[
          { id: 'collection', label: 'Collection ✨' },
          { id: 'wishlist',   label: 'Wishlist 💜' },
          { id: 'binder',     label: 'Binder 📒' },
          { id: 'fortrade',   label: 'For Trade/Sale 💰' },
        ].map(tab => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => { setActiveTab(tab.id); setCollectionPage(1); setWishlistPage(1) }}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border shadow-sm
              ${activeTab === tab.id
                ? 'bg-pink-400 text-white border-pink-400'
                : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
              }`}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* ── Collection tab ─────────────────────────────────────────────────── */}
      {activeTab === 'collection' && (
        <main className="max-w-6xl mx-auto pb-16">
          {collectionItems.length > 0 && (
            <div className="flex items-center justify-between px-4 pb-3">
              <p className="text-xs text-gray-400 font-medium">
                {shopMode
                  ? `${visibleCollection.length} card${visibleCollection.length !== 1 ? 's' : ''} · gift registry`
                  : `${collectionItems.length} total card${collectionItems.length !== 1 ? 's' : ''}`}
              </p>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { setShopMode(m => !m); setCollectionPage(1) }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                           rounded-full border transition-all shadow-sm
                           ${shopMode
                             ? 'bg-amber-400 text-white border-amber-400'
                             : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                           }`}
              >
                🛍 {shopMode ? `Shopping: ${profile.username ?? 'Trainer'}` : `Shop for ${profile.username ?? 'Trainer'}`}
              </motion.button>
            </div>
          )}

          {visibleCollection.length === 0 ? (
            <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
              {shopMode
                ? `${profile.username ?? 'This trainer'} already owns everything with a price tag! 🎉`
                : "This trainer hasn't added any cards to their collection yet! ✨"}
            </p>
          ) : (() => {
            const totalColPages   = Math.ceil(visibleCollection.length / ITEMS_PER_PAGE)
            const collectionSlice = visibleCollection.slice(
              (collectionPage - 1) * ITEMS_PER_PAGE,
              collectionPage * ITEMS_PER_PAGE
            )
            return (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${shopMode ? 'shop' : 'full'}-${collectionPage}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
                  >
                    {collectionSlice.map(item => (
                      <CardTile key={item.card_id} item={item} />
                    ))}
                  </motion.div>
                </AnimatePresence>
                <PaginationBar
                  currentPage={collectionPage}
                  totalPages={totalColPages}
                  onPageChange={p => { setCollectionPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </>
            )
          })()}
        </main>
      )}

      {/* ── Wishlist tab ───────────────────────────────────────────────────── */}
      {activeTab === 'wishlist' && (
        <main className="max-w-6xl mx-auto pb-16">
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400 font-medium">
              {wishlistItems.length} card{wishlistItems.length !== 1 ? 's' : ''} on wishlist
            </p>
          </div>

          {wishlistItems.length === 0 ? (
            <p className="text-center text-violet-300 font-semibold mt-16 text-lg">
              This trainer hasn't added any cards to their wishlist yet! 💜
            </p>
          ) : (() => {
            const totalWishPages = Math.ceil(wishlistItems.length / ITEMS_PER_PAGE)
            const wishlistSlice  = wishlistItems.slice(
              (wishlistPage - 1) * ITEMS_PER_PAGE,
              wishlistPage * ITEMS_PER_PAGE
            )
            return (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`wish-${wishlistPage}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
                  >
                    {wishlistSlice.map(item => (
                      <CardTile key={item.card_id} item={item} />
                    ))}
                  </motion.div>
                </AnimatePresence>
                <PaginationBar
                  currentPage={wishlistPage}
                  totalPages={totalWishPages}
                  onPageChange={p => { setWishlistPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </>
            )
          })()}
        </main>
      )}

      {/* ── Binder tab (read-only, flat style — no glow shadows) ─────────────── */}
      {activeTab === 'binder' && (
        <main className="max-w-2xl mx-auto pb-16 px-0">

          {/* Binder pills — only shown when there is more than one binder */}
          {binders.length > 1 && (
            <div className="px-4 mb-6">
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {binders.map(b => {
                  const isActive = selectedBinder?.id === b.id
                  const col      = b.color ?? '#a78bfa'
                  return (
                    <motion.button
                      key={b.id}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedBinder(b)}
                      className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5
                                 font-bold text-base rounded-full border-2 transition-all"
                      style={isActive
                        ? {
                            color:           '#fff',
                            backgroundColor:  col,
                            borderColor:      col,
                          }
                        : {
                            background:  'rgba(255,255,255,0.75)',
                            borderColor: '#e5e7eb',
                            color:       '#4b5563',
                          }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ background: isActive ? 'rgba(255,255,255,0.8)' : col }}
                      />
                      {b.name}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )}

          <BinderView
            key={selectedBinder?.id ?? 'none'}
            items={items.filter(i => i.owned && i.binder_id === selectedBinder?.id)}
            readOnly
            onCardClick={setSelectedShowcaseItem}
          />

          {selectedBinder && items.filter(i => i.owned && i.binder_id === selectedBinder.id).length === 0 && (
            <p className="text-center text-pink-300 font-semibold text-sm mt-8">
              No collected cards in this binder yet ✨
            </p>
          )}
        </main>
      )}
      {/* ── For Trade / Sale tab ───────────────────────────────────────────── */}
      {activeTab === 'fortrade' && (() => {
        const forTradeItems = items.filter(i => i.category === 'for_sale' || i.category === 'for_trade')
        return (
          <main className="max-w-6xl mx-auto pb-16">
            {forTradeItems.length === 0 ? (
              <p className="text-center text-amber-300 font-semibold mt-16 text-lg">
                {profile.username ?? 'This trainer'} has no cards listed for trade or sale yet 💰
              </p>
            ) : (
              <>
                <div className="px-4 pt-3 pb-2 flex gap-3 flex-wrap">
                  {['for_sale', 'for_trade'].map(cat => {
                    const count = forTradeItems.filter(i => i.category === cat).length
                    if (!count) return null
                    return (
                      <span key={cat} className={`text-xs font-semibold px-3 py-1 rounded-full
                        ${cat === 'for_sale' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {cat === 'for_sale' ? '💰 For Sale' : '🔄 For Trade'} · {count}
                      </span>
                    )
                  })}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key="fortrade"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
                  >
                    {forTradeItems.map(item => (
                      <motion.div
                        key={item.card_id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl overflow-hidden shadow-md flex flex-col border cursor-pointer
                          ${themeMode === 'dark' ? 'bg-amber-900/40 border-amber-700/50' : 'bg-amber-50/95 border-amber-200'}`}
                        onClick={() => setSelectedShowcaseItem(item)}
                      >
                        <div className="relative">
                          <img src={item.image} alt={item.name} className="w-full" loading="lazy"
                               onError={e => { e.currentTarget.src = CARD_BACK }} />
                          <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm leading-none
                            ${item.category === 'for_sale' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {item.category === 'for_sale' ? '💰 For Sale' : '🔄 For Trade'}
                          </span>
                        </div>
                        <div className="p-2 text-center flex flex-col flex-1">
                          <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
                          {(() => {
                            const { value: p, label } = getPriceInfo(item)
                            return p > 0 ? (
                              <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
                                ${p.toFixed(2)}{label ? ` (${label})` : ''}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full">---</span>
                            )
                          })()}
                          {viewer && !isOwnProfile && !viewerOwnedIds.has(item.card_id) && (
                            <div className="mt-auto pt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => addToMyWishlist(item, false)}
                                disabled={savingCardId === item.card_id}
                                className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                                           bg-violet-100 hover:bg-violet-200 text-violet-700 transition-colors disabled:opacity-50"
                              >
                                {savingCardId === item.card_id ? '…' : '💖 Want'}
                              </button>
                              <button
                                onClick={() => addToMyWishlist(item, true)}
                                disabled={savingCardId === item.card_id}
                                className="flex-1 text-[10px] font-semibold py-1 rounded-xl
                                           bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors disabled:opacity-50"
                              >
                                {savingCardId === item.card_id ? '…' : '✅ Have'}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </main>
        )
      })()}

      {/* ── Showcase card detail modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedShowcaseItem && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{ background: 'rgba(255,209,220,0.78)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedShowcaseItem(null)}
          >
            <motion.div
              className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full my-auto relative"
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedShowcaseItem(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/70 hover:bg-white
                           text-gray-400 hover:text-gray-600 flex items-center justify-center
                           shadow-sm transition-colors text-base leading-none"
                aria-label="Close"
              >✕</button>

              <img src={selectedShowcaseItem.image} alt={selectedShowcaseItem.name} className="w-full rounded-2xl mb-4 shadow-md"
                   onError={e => { e.currentTarget.src = CARD_BACK }} />

              <h2 className="text-xl font-bold text-pink-500 mb-0.5">{selectedShowcaseItem.name}</h2>
              <p className="text-sm text-gray-400 mb-3">
                {selectedShowcaseItem.owned ? '📦 In Collection' : '💖 On Wishlist'}
                {selectedShowcaseItem.is_chase && ' · 🎯 Chase Card'}
                {selectedShowcaseItem.is_favorite && ' · ⭐ Favourite'}
              </p>

              {(() => {
                const item = selectedShowcaseItem
                const displayPrice = item.manual_price || item.market_price || item.mid_price || item.low_price
                const rows = [
                  item.manual_price && { label: 'Manual (Override)', value: item.manual_price, highlight: true },
                  item.market_price && { label: 'Market',            value: item.market_price },
                  item.mid_price    && { label: 'Mid',               value: item.mid_price    },
                  item.low_price    && { label: 'Low',               value: item.low_price    },
                ].filter(Boolean)
                return rows.length > 0 ? (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-pink-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">Stored Prices</p>
                    {rows.map(({ label, value, highlight }) => (
                      <div key={label} className={`flex justify-between items-center px-3 py-2 text-sm ${highlight ? 'bg-violet-50' : 'bg-white'}`}>
                        <span className={highlight ? 'text-violet-600 font-medium' : 'text-gray-500'}>{label}</span>
                        <span className={`font-bold ${highlight ? 'text-violet-600' : 'text-pink-600'}`}>${Number(value).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}

              {viewer && !viewerOwnedIds.has(selectedShowcaseItem.card_id) && (
                <div className="flex gap-2 mb-3">
                  <button
                    disabled={savingCardId === selectedShowcaseItem.card_id}
                    onClick={() => { addToMyWishlist(selectedShowcaseItem, false); setSelectedShowcaseItem(null) }}
                    className="flex-1 py-2 rounded-2xl text-sm font-semibold border border-pink-300
                               bg-pink-50 text-pink-500 hover:bg-pink-100 transition-colors disabled:opacity-50"
                  >💖 Want</button>
                  <button
                    disabled={savingCardId === selectedShowcaseItem.card_id}
                    onClick={() => { addToMyWishlist(selectedShowcaseItem, true); setSelectedShowcaseItem(null) }}
                    className="flex-1 py-2 rounded-2xl text-sm font-semibold border border-emerald-300
                               bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >✅ Have</button>
                </div>
              )}

              <a
                href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(selectedShowcaseItem.name)}`}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-pink-400 hover:bg-pink-500 text-white
                           font-semibold py-2 rounded-2xl transition-colors"
              >
                View on TCGPlayer
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  )
}
