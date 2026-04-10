import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import BinderView from './BinderView'

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
          .select('card_id, name, image, owned, market_price, slot_index, binder_id')
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

  const totalValue   = items.reduce((s, i) => s + (i.market_price ?? 0), 0)
  const ownedCount   = items.filter(i => i.owned).length
  const isOwnProfile = viewer?.id === userId
  const canFollow    = viewer && !isOwnProfile
  // Shop mode: only cards with a real price (gift-finding view)
  const visibleItems = shopMode ? items.filter(i => i.market_price > 0) : items

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

        <p className="text-pink-400 text-sm font-medium">
          {items.length} cards · ${totalValue.toFixed(2)} total value · {ownedCount} owned
        </p>

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

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 px-4 pt-1 pb-3 flex-wrap">
        {[
          { id: 'collection', label: 'Collection ✨📦' },
          { id: 'binder',     label: 'Binder 📒' },
        ].map(tab => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border shadow-sm
              ${activeTab === tab.id
                ? 'bg-pink-400 text-white border-pink-400 shadow-pink-200'
                : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
              }`}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* ── Binder (read-only) ─────────────────────────────────────────────── */}
      {activeTab === 'binder' && (
        <main className="max-w-2xl mx-auto pb-16 px-0">

          {/* Hero binder pills — only shown when there is more than one binder */}
          {binders.length > 1 && (
            <div className="px-4 mb-6">
              <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
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
                            boxShadow: `0 0 0 4px ${col}50, 0 0 28px ${col}60, 0 6px 20px ${col}40`,
                          }
                        : {
                            background:  'rgba(255,255,255,0.75)',
                            borderColor: '#e5e7eb',
                            color:       '#4b5563',
                          }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                        style={{ background: isActive ? 'rgba(255,255,255,0.8)' : col }}
                      />
                      {b.name}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )}

          {/* BinderView — owned cards in the selected binder only */}
          <BinderView
            key={selectedBinder?.id ?? 'none'}
            items={items.filter(i => i.owned && i.binder_id === selectedBinder?.id)}
            readOnly
          />

          {/* Empty state when a binder has no owned cards */}
          {selectedBinder && items.filter(i => i.owned && i.binder_id === selectedBinder.id).length === 0 && (
            <p className="text-center text-pink-300 font-semibold text-sm mt-8">
              No collected cards in this binder yet ✨
            </p>
          )}
        </main>
      )}

      {/* ── Collection ─────────────────────────────────────────────────────── */}
      {activeTab === 'collection' && (
        <main className="max-w-6xl mx-auto pb-16">

          {/* Shop mode toggle bar */}
          {items.length > 0 && (
            <div className="flex items-center justify-between px-4 pb-3">
              <p className="text-xs text-gray-400 font-medium">
                {shopMode
                  ? `${visibleItems.length} priced cards · shop view`
                  : `${items.length} total cards`}
              </p>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShopMode(m => !m)}
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

          {visibleItems.length === 0 ? (
            <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
              {shopMode
                ? 'No priced cards in this collection 🛍'
                : 'This collection is empty ✨'}
            </p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={shopMode ? 'shop' : 'full'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
              >
                {visibleItems.map(item => (
                  <motion.div
                    key={item.card_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden shadow-md"
                    style={{
                      background:     item.owned ? 'rgba(236,253,245,0.7)' : 'rgba(255,255,255,0.45)',
                      backdropFilter: 'blur(10px)',
                      border:         item.owned ? '1.5px solid #6ee7b7' : '1px solid rgba(255,255,255,0.6)',
                    }}
                  >
                    <img src={item.image} alt={item.name} className="w-full" loading="lazy" />
                    <div className="p-2 text-center">
                      <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
                      {item.market_price > 0 && (
                        <p className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5
                                       rounded-full inline-block mb-1">
                          ${item.market_price.toFixed(2)}
                        </p>
                      )}
                      {item.owned && (
                        <span className="block text-xs text-emerald-600 font-semibold mt-0.5">
                          ✅ Owned
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      )}
    </Shell>
  )
}
