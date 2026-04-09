import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

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

// ─── Main dashboard ──────────────────────────────────────────────────────────
export default function WishlistDashboard({ user, onToast }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchWishlist() {
    if (!user) return
    const { data } = await supabase
      .from('wishlists')
      .select('card_id, name, image, owned, market_price')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchWishlist() }, [user])

  async function toggleOwned(cardId, currentOwned) {
    // Optimistic update
    setItems(prev => prev.map(i => i.card_id === cardId ? { ...i, owned: !currentOwned } : i))
    const { error } = await supabase
      .from('wishlists')
      .update({ owned: !currentOwned })
      .eq('user_id', user.id)
      .eq('card_id', cardId)
    if (error) {
      // Roll back on failure
      setItems(prev => prev.map(i => i.card_id === cardId ? { ...i, owned: currentOwned } : i))
    } else {
      onToast(!currentOwned ? 'Marked as owned! 🌸' : 'Removed from owned')
    }
  }

  async function removeCard(cardId) {
    setItems(prev => prev.filter(i => i.card_id !== cardId))
    await supabase.from('wishlists').delete().eq('user_id', user.id).eq('card_id', cardId)
    onToast('Removed from wishlist')
  }

  if (!user) {
    return (
      <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
        Login to see your wishlist 💖
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

  if (!items.length) {
    return (
      <p className="text-center text-pink-300 font-semibold mt-16 text-lg">
        Your wishlist is empty — add some cards! 🌸
      </p>
    )
  }

  const totalItems  = items.length
  const ownedItems  = items.filter(i => i.owned).length
  const totalValue  = items.reduce((s, i) => s + (i.market_price ?? 0), 0)
  const ownedValue  = items.filter(i => i.owned).reduce((s, i) => s + (i.market_price ?? 0), 0)

  return (
    <>
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
                title="Remove from wishlist"
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
    </>
  )
}
