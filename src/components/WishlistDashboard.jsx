import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import BinderView from './BinderView'

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    setValue(0)
    if (!target) return
    const start = performance.now()
    const frame = (now) => {
      const p     = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)   // ease-out cubic
      setValue(target * eased)
      if (p < 1) requestAnimationFrame(frame)
      else setValue(target)
    }
    requestAnimationFrame(frame)
  }, [target, duration])
  return value
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, prefix = '', suffix = '', decimals = 0, color = 'pink', icon }) {
  const animated = useCountUp(value)
  const display  = decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()

  const palette = {
    pink:  'from-pink-100/80 to-rose-100/60 border-pink-200',
    blue:  'from-sky-100/80 to-blue-100/60 border-blue-200',
    mint:  'from-emerald-100/80 to-teal-100/60 border-emerald-200',
    lilac: 'from-violet-100/80 to-purple-100/60 border-purple-200',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-gradient-to-br backdrop-blur-md p-4 shadow-sm ${palette[color]}`}
    >
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-gray-700">
        {prefix}{display}{suffix}
      </p>
    </motion.div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ owned, total }) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{owned} owned</span><span>{pct}%</span>
      </div>
      <div className="h-2.5 bg-white/60 rounded-full overflow-hidden border border-pink-100">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

// ─── Top 3 high-rollers ───────────────────────────────────────────────────────
function HighRollers({ items }) {
  const top3 = [...items]
    .filter(i => i.market_price > 0)
    .sort((a, b) => b.market_price - a.market_price)
    .slice(0, 3)

  if (!top3.length) return null

  return (
    <div className="mx-4 mb-4 p-4 rounded-2xl border border-yellow-200 bg-gradient-to-r from-yellow-50/80 to-amber-50/60 backdrop-blur-md shadow-sm">
      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-3">👑 Top High-Rollers</p>
      <div className="flex gap-3 justify-center flex-wrap">
        {top3.map((item, i) => (
          <motion.div
            key={item.card_id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.12 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="relative">
              {i === 0 && (
                <span className="absolute -top-2 -right-2 text-base z-10">👑</span>
              )}
              <img
                src={item.image}
                alt={item.name}
                className="w-16 rounded-xl shadow-md border-2 border-yellow-300"
              />
            </div>
            <p className="text-xs font-bold text-gray-600 text-center max-w-[64px] truncate">{item.name}</p>
            <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              ${item.market_price.toFixed(2)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Trainer card (followed user preview) ────────────────────────────────────
function TrainerCard({ trainer }) {
  const shareUrl = `${window.location.origin}/share/${trainer.id}`
  const initial  = trainer.username?.[0]?.toUpperCase() ?? '?'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-pink-200 bg-white/50 backdrop-blur-md p-4 shadow-sm"
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center
                     text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #f9a8d4, #a78bfa)' }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-700 truncate">
            {trainer.username ?? 'Unknown Trainer'}
          </p>
          <p className="text-xs text-gray-400">
            {trainer.topCards.length > 0
              ? `Top card: $${trainer.topCards[0].market_price.toFixed(2)}`
              : 'No priced cards yet'}
          </p>
        </div>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-pink-400 hover:text-pink-600
                     whitespace-nowrap transition-colors"
        >
          View →
        </a>
      </div>

      {/* Top-3 card previews */}
      <div className="flex gap-1.5">
        {trainer.topCards.map(card => (
          <div key={card.card_id} className="flex-1 relative">
            <img
              src={card.image}
              alt={card.name}
              className="w-full rounded-lg shadow-sm"
              loading="lazy"
            />
            <span
              className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none
                         bg-pink-500/90 text-white rounded px-1 py-0.5"
            >
              ${card.market_price.toFixed(2)}
            </span>
          </div>
        ))}
        {/* Empty placeholders so the row always has 3 slots */}
        {Array.from({ length: 3 - trainer.topCards.length }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-lg bg-pink-50/60 border border-dashed border-pink-200"
            style={{ aspectRatio: '2.5 / 3.5' }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Support card ─────────────────────────────────────────────────────────────
function SupportCard() {
  return (
    <motion.a
      href="https://ko-fi.com/qakirap"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="block rounded-2xl p-4 shadow-sm border border-amber-200 no-underline"
      style={{
        background: 'linear-gradient(135deg, rgba(254,243,199,0.85) 0%, rgba(253,230,138,0.6) 50%, rgba(252,211,77,0.3) 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">☕</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800">Support Poképop</p>
          <p className="text-xs text-amber-600">
            Enjoying the app? A coffee helps keep the cards flowing ✨
          </p>
        </div>
        <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
          Ko-fi →
        </span>
      </div>
    </motion.a>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────
export default function WishlistDashboard({ user, onToast, onGoExplore }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [isPublic,  setIsPublic]  = useState(false)
  const [toggling,  setToggling]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [activeTab,        setActiveTab]        = useState('collection')  // 'collection' | 'binder' | 'trainers'
  const [followedTrainers, setFollowedTrainers] = useState([])

  const shareUrl = `${window.location.origin}/share/${user?.id}`

  async function fetchWishlist() {
    if (!user) return

    // Single round-trip: wishlist + profile + follow IDs all at once
    const [{ data: wishlist }, { data: prof }, { data: followData }] = await Promise.all([
      supabase
        .from('wishlists')
        .select('card_id, name, image, owned, market_price, slot_index')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('is_public')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id),
    ])

    setItems(wishlist ?? [])
    setIsPublic(prof?.is_public ?? false)

    // Fetch followed trainers' profiles + top-3 priced cards in a second parallel round-trip
    const followedIds = (followData ?? []).map(f => f.following_id)
    if (followedIds.length > 0) {
      const [{ data: followedProfiles }, { data: followedCards }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username')
          .in('id', followedIds),
        supabase
          .from('wishlists')
          .select('user_id, card_id, name, image, market_price')
          .in('user_id', followedIds)
          .gt('market_price', 0)
          .order('market_price', { ascending: false }),
      ])

      // Group: top-3 priced cards per trainer (already sorted desc by market_price)
      const cardsByUser = {}
      for (const card of (followedCards ?? [])) {
        if (!cardsByUser[card.user_id]) cardsByUser[card.user_id] = []
        if (cardsByUser[card.user_id].length < 3) cardsByUser[card.user_id].push(card)
      }

      setFollowedTrainers(
        (followedProfiles ?? []).map(p => ({ ...p, topCards: cardsByUser[p.id] ?? [] }))
      )
    } else {
      setFollowedTrainers([])
    }

    setLoading(false)
  }

  useEffect(() => { fetchWishlist() }, [user])

  async function togglePublic() {
    const next = !isPublic
    setIsPublic(next)          // optimistic — UI responds instantly
    setToggling(true)
    const { error } = await supabase
      .from('profiles')
      .update({ is_public: next })
      .eq('id', user.id)
    if (error) {
      setIsPublic(!next)       // revert on failure
    } else {
      onToast(next ? 'Collection is now public 🔓' : 'Collection set to private 🔒')
    }
    setToggling(false)
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      onToast('Share link copied! ✨')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  async function toggleOwned(cardId, currentOwned) {
    // Optimistic update
    setItems(prev => prev.map(i => i.card_id === cardId ? { ...i, owned: !currentOwned } : i))
    const { error } = await supabase
      .from('wishlists')
      .update({ owned: !currentOwned })
      .eq('user_id', user.id)
      .eq('card_id', cardId)
    if (error) {
      setItems(prev => prev.map(i => i.card_id === cardId ? { ...i, owned: currentOwned } : i))
    } else {
      onToast(!currentOwned ? 'Added to Collection! ✨📦' : 'Moved back to Wishlist 💖')
    }
  }

  async function removeCard(cardId) {
    setItems(prev => prev.filter(i => i.card_id !== cardId))
    await supabase.from('wishlists').delete().eq('user_id', user.id).eq('card_id', cardId)
    onToast('Removed from Wishlist & Collection')
  }

  if (!user) {
    return (
      <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
        Login to see your Wishlist & Collection ✨📦
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <motion.div
          className="w-10 h-10 rounded-full border-4 border-pink-300 border-t-pink-500"
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        />
      </div>
    )
  }

  const totalItems  = items.length
  const ownedItems  = items.filter(i => i.owned).length
  const totalValue  = items.reduce((s, i) => s + (i.market_price ?? 0), 0)
  const ownedValue  = items.filter(i => i.owned).reduce((s, i) => s + (i.market_price ?? 0), 0)

  return (
    <>
      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-2 px-4 pt-2 pb-4">
        {[
          { id: 'collection', label: 'Wishlist & Collection ✨📦' },
          { id: 'binder',     label: 'Virtual Binder 📒' },
          { id: 'trainers',   label: `Following 👥${followedTrainers.length ? ` · ${followedTrainers.length}` : ''}` },
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

      {/* ── Binder view ────────────────────────────────────────────── */}
      {activeTab === 'binder' && <BinderView items={items} user={user} />}

      {/* ── Followed trainers ──────────────────────────────────────── */}
      {activeTab === 'trainers' && (
        <div className="max-w-2xl mx-auto px-4 pb-16">
          {followedTrainers.length === 0 ? (
            <div className="flex flex-col items-center text-center mt-16 px-4 gap-4">
              <p className="text-5xl">🔍</p>
              <div>
                <p className="text-pink-400 font-bold text-lg mb-1">
                  Find your friends!
                </p>
                <p className="text-sm text-gray-400 max-w-xs">
                  Search for a Pokémon, find a card you love, then visit a
                  trainer's public page and tap{' '}
                  <span className="font-semibold text-pink-400">Follow Trainer ✨</span>
                  {' '}to see their collection here.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={onGoExplore}
                className="bg-pink-400 hover:bg-pink-500 text-white font-semibold
                           px-6 py-2.5 rounded-full shadow-md transition-colors"
              >
                Start Exploring 🌸
              </motion.button>

              {/* Support card sits below the CTA even when empty */}
              <div className="w-full mt-6">
                <SupportCard />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 pt-2">
              {followedTrainers.map(trainer => (
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
              {/* Support card anchored at the bottom of the list */}
              <SupportCard />
            </div>
          )}
        </div>
      )}

      {/* ── Collection view ────────────────────────────────────────── */}
      {activeTab === 'collection' && (
      <>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center mt-8 px-4 pb-8">
          <p className="text-pink-300 font-semibold text-lg mb-4">
            Your collection is empty! Go find some cards! ✨
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={onGoExplore}
            className="bg-pink-400 hover:bg-pink-500 text-white font-semibold
                       px-6 py-2.5 rounded-full shadow-md transition-colors"
          >
            Start Exploring 🌸
          </motion.button>
        </div>
      )}

      {items.length > 0 && <>

      {/* ── Stats grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        <StatCard icon="💖" label="Total Cards"      value={totalItems}  color="pink"  />
        <StatCard icon="💰" label="Total Value"      value={totalValue}  color="blue"  prefix="$" decimals={2} />
        <StatCard icon="🌟" label="Value Collected"  value={ownedValue}  color="mint"  prefix="$" decimals={2} />
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100/80 to-purple-100/60 backdrop-blur-md p-4 shadow-sm">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Collection Progress</p>
          <p className="text-2xl font-bold text-gray-700">{ownedItems}<span className="text-base text-gray-400">/{totalItems}</span></p>
          <ProgressBar owned={ownedItems} total={totalItems} />
        </div>
      </div>

      {/* ── Share panel ────────────────────────────────────────────── */}
      <div className="mx-4 mb-4 rounded-2xl border border-pink-200 bg-white/50 backdrop-blur-md shadow-sm overflow-hidden">

        {/* Toggle row */}
        <div className="flex items-center gap-3 p-4">
          <span className="text-xl select-none">{isPublic ? '🔓' : '🔒'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">Public Collection</p>
            <p className="text-xs text-gray-400 truncate">
              {isPublic ? 'Sharing active — anyone with your link can view' : 'Your collection is private'}
            </p>
          </div>

          {/* Sliding pill toggle */}
          <button
            onClick={togglePublic}
            disabled={toggling}
            aria-label="Toggle public collection"
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
                       transition-colors duration-200 ease-in-out
                       focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-1
                       disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: isPublic ? '#ec4899' : '#e5e7eb' }}
          >
            <span
              className="inline-block h-5 w-5 rounded-full bg-white shadow-md
                         transform transition-transform duration-200 ease-in-out"
              style={{ transform: isPublic ? 'translateX(1.25rem)' : 'translateX(0.125rem)' }}
            />
          </button>
        </div>

        {/* Sharing-active section — slides in when public */}
        <AnimatePresence>
          {isPublic && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-3 border-t border-pink-100 space-y-3">

                <p className="text-[11px] font-semibold text-pink-500 uppercase tracking-wide">
                  ✨ Sharing Active
                </p>

                {/* URL display */}
                <div className="flex items-center bg-pink-50/70 rounded-xl border border-pink-100 px-3 py-2">
                  <span className="text-xs text-gray-500 font-mono truncate flex-1 select-all">
                    {shareUrl}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={copyShareLink}
                    className="flex items-center gap-1.5 bg-pink-400 hover:bg-pink-500 text-white
                               text-xs font-semibold px-4 py-2 rounded-full shadow-sm transition-colors"
                  >
                    {copied ? '✅ Copied!' : '🌸 Copy Link'}
                  </motion.button>

                  <motion.a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1.5 bg-white/70 hover:bg-white text-pink-500
                               text-xs font-semibold px-4 py-2 rounded-full shadow-sm
                               border border-pink-200 transition-colors"
                  >
                    👁 View as Guest
                  </motion.a>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Top 3 ──────────────────────────────────────────────────── */}
      <HighRollers items={items} />

      {/* ── Card grid ──────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      >
        <AnimatePresence>
          {items.map(item => (
            <motion.div
              key={item.card_id}
              layout
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="rounded-2xl overflow-hidden shadow-md relative"
              style={{
                background: item.owned
                  ? 'rgba(236,253,245,0.7)'
                  : 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(10px)',
                border: item.owned ? '1.5px solid #6ee7b7' : '1px solid rgba(255,255,255,0.6)',
              }}
            >
              {/* Remove button */}
              <button
                onClick={() => removeCard(item.card_id)}
                className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/70
                           text-gray-400 hover:text-red-400 hover:bg-white text-xs leading-none
                           flex items-center justify-center shadow-sm transition-colors"
                title="Remove from Wishlist & Collection"
              >
                ✕
              </button>

              <img src={item.image} alt={item.name} className="w-full" loading="lazy" />

              <div className="p-2 text-center">
                <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
                {item.market_price > 0 && (
                  <p className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full inline-block mb-1">
                    ${item.market_price.toFixed(2)}
                  </p>
                )}
                {/* Owned toggle */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggleOwned(item.card_id, item.owned)}
                  className={`w-full text-xs font-semibold py-1.5 rounded-xl transition-all mt-1
                    ${item.owned
                      ? 'bg-emerald-400 text-white hover:bg-emerald-500'
                      : 'bg-white/70 text-gray-400 hover:bg-pink-50 hover:text-pink-500 border border-gray-200'
                    }`}
                >
                  {item.owned ? '✅ I own this!' : '🌸 I own this'}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      </>}  {/* end items.length > 0 */}
      </>)}  {/* end activeTab === 'collection' */}
    </>
  )
}
