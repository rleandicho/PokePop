import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import BinderView from './BinderView'

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

  // Binder navigation
  const [binders,        setBinders]        = useState([])
  const [selectedBinder, setSelectedBinder] = useState(null)

  // Shop mode: filter collection to cards with a TCGPlayer price
  const [shopMode,       setShopMode]       = useState(false)

  // Pagination
  const [collectionPage, setCollectionPage] = useState(1)
  const [wishlistPage,   setWishlistPage]   = useState(1)

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

      // Fetch wishlist + binders + follow status in one round-trip.
      // nullsFirst: false → slot-indexed cards first, unpositioned cards fill gaps after.
      const checkFollow = currentUser && currentUser.id !== userId
      const queries = [
        supabase
          .from('wishlists')
          .select('card_id, name, image, owned, market_price, mid_price, low_price, slot_index, binder_id')
          .eq('user_id', userId)
          .order('slot_index', { ascending: true, nullsFirst: false }),
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

      const [{ data: wishlist }, { data: binderData }, followResult] = await Promise.all(queries)
      setItems(wishlist ?? [])

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

  // ── Shared shell ──────────────────────────────────────────────────────────
  function Shell({ children }) {
    return (
      <div
        className="min-h-screen"
        style={{ background: 'linear-gradient(135deg, #FFD1DC 0%, #FFF0F5 50%, #B2E2F2 100%)' }}
      >
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
            ← Return to Poképop 🌸
          </Link>
        </div>
      </Shell>
    )
  }

  // ── Price fallback: market → mid → low → 0 ──────────────────────────────────
  function getDisplayPrice(item) {
    return item.market_price || item.mid_price || item.low_price || 0
  }
  // Returns { value, label } so CardTile can show "(Mid)" / "(Low)" source hints
  function getPriceInfo(item) {
    if (item.market_price) return { value: item.market_price, label: '' }
    if (item.mid_price)    return { value: item.mid_price,    label: 'Mid' }
    if (item.low_price)    return { value: item.low_price,    label: 'Low' }
    return { value: 0, label: '' }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const collectionItems   = items.filter(i => i.owned)
  const wishlistItems     = items.filter(i => !i.owned)
  const collectionValue   = collectionItems.reduce((s, i) => s + getDisplayPrice(i), 0)
  const wishlistValue     = wishlistItems.reduce((s, i) => s + getDisplayPrice(i), 0)
  const isOwnProfile      = viewer?.id === userId
  const canFollow         = viewer && !isOwnProfile

  const visibleCollection = shopMode
    ? collectionItems.filter(i => getDisplayPrice(i) > 0)
    : collectionItems

  // ── Card tile ─────────────────────────────────────────────────────────────
  function CardTile({ item }) {
    const is1stEd = item.card_id?.endsWith('-1st')
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden shadow-md flex flex-col"
        style={{
          background:     item.owned ? 'rgba(236,253,245,0.7)' : 'rgba(245,243,255,0.65)',
          backdropFilter: 'blur(10px)',
          border:         item.owned ? '1.5px solid #6ee7b7' : '1.5px solid #c4b5fd',
        }}
      >
        <div className="relative">
          <img src={item.image} alt={item.name} className="w-full" loading="lazy" />
          {is1stEd && (
            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-amber-400 text-white
                             border border-amber-500 px-2 py-0.5 rounded-full shadow-sm leading-none">
              ⭐ 1st Edition
            </span>
          )}
        </div>
        <div className="p-2 text-center flex flex-col flex-1">
          <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
          {(() => {
            const { value: p, label } = getPriceInfo(item)
            const is1st = item.card_id?.endsWith('-1st')
            return p > 0 ? (
              <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
                <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
                  ${p.toFixed(2)}{label ? ` (${label})` : ''}
                </span>
                {is1st && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
                    1st Ed Price
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs font-medium text-gray-300 bg-gray-100 px-2 py-0.5
                             rounded-full inline-block mb-1 mx-auto">
                {is1st ? '1st Ed — Checking…' : '---'}
              </p>
            )
          })()}
          {item.owned && (
            <span className="block text-xs text-emerald-600 font-semibold mt-0.5">
              ✅ Owned
            </span>
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

  console.log('Current Items:', items)

  return (
    <Shell>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="text-center pt-8 pb-4 px-4 space-y-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 bg-white/60 hover:bg-pink-100
                     text-pink-500 font-semibold text-sm px-4 py-2 rounded-full
                     border border-pink-200 shadow-sm transition-all"
        >
          ← Return to Poképop 🌸
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

      {/* ── Split stats: collection (emerald) + wishlist (violet) ────────────── */}
      <div className="max-w-md mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 text-center border border-emerald-200"
               style={{ background: 'rgba(236,253,245,0.75)', backdropFilter: 'blur(8px)' }}>
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

          <div className="rounded-2xl p-4 text-center border border-violet-200"
               style={{ background: 'rgba(245,243,255,0.75)', backdropFilter: 'blur(8px)' }}>
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

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 px-4 pt-1 pb-3 flex-wrap">
        {[
          { id: 'collection', label: 'Collection ✨' },
          { id: 'wishlist',   label: 'Wishlist 💜' },
          { id: 'binder',     label: 'Binder 📒' },
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
          />

          {selectedBinder && items.filter(i => i.owned && i.binder_id === selectedBinder.id).length === 0 && (
            <p className="text-center text-pink-300 font-semibold text-sm mt-8">
              No collected cards in this binder yet ✨
            </p>
          )}
        </main>
      )}
    </Shell>
  )
}
