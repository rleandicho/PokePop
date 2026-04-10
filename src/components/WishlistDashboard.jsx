import { useState, useEffect, useRef } from 'react'
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
function MiniCardRow({ cards, emptyColor = 'pink', badge }) {
  return (
    <div className="flex gap-1.5">
      {cards.map(card => (
        <div key={card.card_id} className="flex-1 relative">
          <img
            src={card.image}
            alt={card.name}
            className="w-full rounded-lg shadow-sm"
            loading="lazy"
          />
          {badge && card.market_price > 0 && (
            <span
              className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none
                         bg-emerald-500/90 text-white rounded px-1 py-0.5"
            >
              ${card.market_price.toFixed(2)}
            </span>
          )}
        </div>
      ))}
      {/* Empty placeholders — always fill to 3 slots */}
      {Array.from({ length: 3 - cards.length }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-lg border border-dashed
            ${emptyColor === 'emerald'
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-pink-50/60 border-pink-200'
            }`}
          style={{ aspectRatio: '2.5 / 3.5' }}
        />
      ))}
    </div>
  )
}

function TrainerCard({ trainer }) {
  const shareUrl   = `${window.location.origin}/share/${trainer.id}`
  const initial    = trainer.username?.[0]?.toUpperCase() ?? '?'
  const topOwned   = trainer.topOwned   ?? []
  const topWishlist = trainer.topWishlist ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-pink-200 bg-white/50 backdrop-blur-md p-4 shadow-sm"
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-4">
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
            {topOwned.length > 0
              ? `Top card: $${topOwned[0].market_price.toFixed(2)}`
              : 'No owned cards yet'}
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

      {/* Top Collection */}
      <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-1.5">
        🏆 Top Collection
      </p>
      <MiniCardRow cards={topOwned} emptyColor="emerald" badge />

      {/* Most Wanted */}
      <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide mt-3 mb-1.5">
        💖 Most Wanted
      </p>
      <MiniCardRow cards={topWishlist} emptyColor="pink" />
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
            Fund a Pack! 🃏 Every bit helps me chase the next big hit for the collection.
          </p>
        </div>
        <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
          Ko-fi →
        </span>
      </div>
    </motion.a>
  )
}

// ─── Account settings modal ───────────────────────────────────────────────────
function AccountSettingsModal({ user, onToast, onClose }) {
  const [username,    setUsername]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [deleteStep,  setDeleteStep]  = useState(0)   // 0=idle 1=confirm 2=final
  const [deleteInput, setDeleteInput] = useState('')

  // Load current username on open
  useEffect(() => {
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username) })
  }, [user.id])

  async function saveUsername() {
    const trimmed = username.trim()
    if (!trimmed) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      onToast('Username already taken 😿 Try another!')
    } else {
      onToast('Username updated! ✨')
      onClose()
    }
  }

  async function deleteAccount() {
    // Delete all user data then sign out (Supabase cascade handles DB rows)
    await supabase.from('wishlists').delete().eq('user_id', user.id)
    await supabase.from('follows').delete().eq('follower_id', user.id)
    await supabase.from('follows').delete().eq('following_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    onToast('Account deleted. Goodbye 💔')
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(255,209,220,0.55)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-w-sm w-full"
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-pink-500">⚙️ Account Settings</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none">✕</button>
        </div>

        {/* Username */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Username
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              placeholder="your_trainer_name"
              maxLength={30}
              className="flex-1 bg-pink-50/60 border border-pink-200 rounded-xl px-3 py-2
                         text-sm text-gray-700 placeholder-gray-300
                         focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={saveUsername}
              disabled={saving || !username.trim()}
              className="bg-pink-400 hover:bg-pink-500 disabled:opacity-50 text-white
                         font-semibold text-sm px-4 rounded-xl transition-colors"
            >
              {saving ? '…' : 'Save'}
            </motion.button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">
            ⚠️ Danger Zone
          </p>

          {deleteStep === 0 && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setDeleteStep(1)}
              className="w-full bg-red-50 hover:bg-red-100 text-red-400 border border-red-200
                         font-semibold text-sm py-2 rounded-xl transition-colors"
            >
              Delete Account
            </motion.button>
          )}

          {deleteStep === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 text-center">
                This will permanently delete your collection, binders, and follows. Type{' '}
                <span className="font-bold text-red-400">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-red-50/60 border border-red-200 rounded-xl px-3 py-2
                           text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStep(0); setDeleteInput('') }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500
                             font-semibold text-sm py-2 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={deleteAccount}
                  disabled={deleteInput !== 'DELETE'}
                  className="flex-1 bg-red-400 hover:bg-red-500 disabled:opacity-40
                             text-white font-semibold text-sm py-2 rounded-xl transition-colors"
                >
                  Confirm Delete
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── New binder modal ─────────────────────────────────────────────────────────
const BINDER_COLOR_PRESETS = [
  '#f9a8d4', '#a78bfa', '#6ee7b7', '#7dd3fc', '#fb7185', '#fbbf24', '#1e1b4b',
]

function NewBinderModal({ onSave, onClose }) {
  const [name,   setName]   = useState('')
  const [color,  setColor]  = useState('#a78bfa')
  const [saving, setSaving] = useState(false)
  const colorRef = useRef(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const ok = await onSave(trimmed, color)   // waits for Supabase insert
    setSaving(false)
    if (ok) onClose()                          // only close on success
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(255,209,220,0.55)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-6 max-w-xs w-full"
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-pink-500">📒 New Binder</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none">✕</button>
        </div>

        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Binder Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. Shiny Hunters"
          maxLength={40}
          autoFocus
          className="w-full bg-pink-50/60 border border-pink-200 rounded-xl px-3 py-2
                     text-sm text-gray-700 placeholder-gray-300 mb-4
                     focus:outline-none focus:ring-2 focus:ring-pink-300"
        />

        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Cover Color
        </label>
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {BINDER_COLOR_PRESETS.map(hex => (
            <button
              key={hex}
              onClick={() => setColor(hex)}
              className="w-7 h-7 rounded-full shadow-sm transition-transform hover:scale-110"
              style={{
                background: hex,
                border: color === hex ? '2.5px solid #374151' : '2px solid rgba(0,0,0,0.12)',
                outline: color === hex ? '2px solid white' : 'none',
                outlineOffset: '-3px',
              }}
            />
          ))}
          <button
            onClick={() => colorRef.current?.click()}
            className="w-7 h-7 rounded-full shadow-sm flex items-center justify-center text-[10px]"
            style={{
              background: BINDER_COLOR_PRESETS.includes(color) ? 'rgba(255,255,255,0.7)' : color,
              border: !BINDER_COLOR_PRESETS.includes(color) ? '2.5px solid #374151' : '2px solid rgba(0,0,0,0.12)',
            }}
          >
            {BINDER_COLOR_PRESETS.includes(color) ? '✎' : ''}
          </button>
          <input ref={colorRef} type="color" className="sr-only" value={color} onChange={e => setColor(e.target.value)} />
        </div>

        {/* Preview swatch */}
        <div
          className="w-full h-8 rounded-xl mb-5 shadow-sm"
          style={{ background: `linear-gradient(to right, ${color}, ${color}99)` }}
        />

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="w-full bg-pink-400 hover:bg-pink-500 disabled:opacity-50 text-white
                     font-semibold py-2.5 rounded-2xl transition-colors"
        >
          {saving ? 'Creating…' : 'Create Binder 📒'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────
export default function WishlistDashboard({ user, onToast, onGoExplore, onBinderChange }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [isPublic,  setIsPublic]  = useState(false)
  const [toggling,  setToggling]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [activeTab,        setActiveTab]        = useState('collection')  // 'collection' | 'binder' | 'trainers'
  const [followedTrainers, setFollowedTrainers] = useState([])

  // ── Binder state ──────────────────────────────────────────────────────────
  const [binders,         setBinders]         = useState([])
  const [selectedBinder,  setSelectedBinder]  = useState(null)  // { id, name, color, coverColor, pageStyle }
  const [showNewBinder,   setShowNewBinder]   = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)

  // Notify App whenever the active binder changes (so CardGrid can route new cards here)
  useEffect(() => { onBinderChange?.(selectedBinder?.id ?? null) }, [selectedBinder])

  const shareUrl = `${window.location.origin}/share/${user?.id}`

  async function fetchWishlist() {
    if (!user) return

    // Single round-trip: wishlist + profile + follow IDs + binders all at once
    const [{ data: wishlist }, { data: prof }, { data: followData }, { data: binderData }] = await Promise.all([
      supabase
        .from('wishlists')
        .select('card_id, name, image, owned, market_price, slot_index, binder_id')
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
      supabase
        .from('binders')
        .select('id, name, color, cover_color, page_style')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

    setItems(wishlist ?? [])
    setIsPublic(prof?.is_public ?? false)

    let loadedBinders = binderData ?? []

    // ── Auto-create "Main Binder" for users who have none ─────────────────────
    if (loadedBinders.length === 0) {
      const { data: newBinder, error: binderErr } = await supabase
        .from('binders')
        .insert({
          user_id:    user.id,
          name:       'Main Binder',
          color:      '#a78bfa',
          cover_color: '#a78bfa',
          page_style:  'white',
        })
        .select('id, name, color, cover_color, page_style')
        .single()
      if (binderErr) console.error('Auto-create Main Binder failed:', binderErr)
      if (newBinder) loadedBinders = [newBinder]
    }

    setBinders(loadedBinders)
    // Always select the first binder on initial load; keep selection if user already chose one
    setSelectedBinder(prev => {
      const stillExists = prev && loadedBinders.some(b => b.id === prev.id)
      return stillExists ? prev : (loadedBinders[0] ?? null)
    })

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
          .select('user_id, card_id, name, image, market_price, owned, created_at')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false }),
      ])

      // Group all fetched cards by user (already ordered by created_at DESC from DB)
      const cardsByUser = {}
      for (const card of (followedCards ?? [])) {
        if (!cardsByUser[card.user_id]) cardsByUser[card.user_id] = []
        cardsByUser[card.user_id].push(card)
      }

      setFollowedTrainers(
        (followedProfiles ?? []).map(p => {
          const all = cardsByUser[p.id] ?? []
          // Top 3 owned cards by market_price descending; null/0 prices sort to the end
          const topOwned = all
            .filter(c => c.owned)
            .sort((a, b) => (b.market_price ?? 0) - (a.market_price ?? 0))
            .slice(0, 3)
          // Top 3 most-recently-added wishlist cards (DB already sorted created_at DESC)
          const topWishlist = all
            .filter(c => !c.owned)
            .slice(0, 3)
          return { ...p, topOwned, topWishlist }
        })
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

  async function createBinder(name, color) {
    const payload = {
      user_id:    user.id,   // required by RLS policy: auth.uid() = user_id
      name,
      color,
      cover_color: color,    // explicit so NOT NULL columns never fail
      page_style:  'white',  // explicit default — avoids NULL constraint errors
    }

    const { data, error } = await supabase
      .from('binders')
      .insert(payload)
      .select('id, name, color, cover_color, page_style')
      .single()

    if (error || !data) {
      // Surface the real Supabase error so it's debuggable
      console.error('Binder creation error:', error)
      onToast(`Binder error: ${error?.message ?? 'unknown — check console'}`)
      return false
    }

    setBinders(prev => [...prev, data])
    setSelectedBinder(data)
    onToast(`Binder "${name}" created! 📒`)
    return true
  }

  async function deleteBinder(binderId) {
    // 1. Unhome all cards in this binder (set binder_id → null, keep the cards)
    setItems(prev => prev.map(i => i.binder_id === binderId ? { ...i, binder_id: null } : i))
    await supabase
      .from('wishlists')
      .update({ binder_id: null })
      .eq('user_id', user.id)
      .eq('binder_id', binderId)

    // 2. Delete the binder row
    await supabase
      .from('binders')
      .delete()
      .eq('id', binderId)
      .eq('user_id', user.id)

    // 3. Update local binder list and auto-select another binder
    setBinders(prev => {
      const remaining = prev.filter(b => b.id !== binderId)
      setSelectedBinder(remaining[0] ?? null)
      return remaining
    })
    onToast('Binder deleted — cards moved to inbox 📥')
  }

  async function moveCardToBinder(cardId, binderId) {
    // Optimistic update
    setItems(prev => prev.map(i =>
      i.card_id === cardId ? { ...i, binder_id: binderId || null } : i
    ))
    const { error } = await supabase
      .from('wishlists')
      .update({ binder_id: binderId || null })
      .eq('user_id', user.id)
      .eq('card_id', cardId)
    if (error) {
      // Revert on failure
      setItems(prev => prev.map(i =>
        i.card_id === cardId ? { ...i, binder_id: items.find(x => x.card_id === cardId)?.binder_id } : i
      ))
      onToast('Could not move card 😿')
    }
  }

  async function updateBinderTheme(binderId, theme) {
    // Persist cover_color and page_style back to the binders table
    await supabase
      .from('binders')
      .update({ cover_color: theme.coverColor, page_style: theme.pageStyle })
      .eq('id', binderId)
    // Keep local state in sync
    setBinders(prev => prev.map(b => b.id === binderId
      ? { ...b, cover_color: theme.coverColor, page_style: theme.pageStyle }
      : b
    ))
    setSelectedBinder(prev => prev?.id === binderId
      ? { ...prev, cover_color: theme.coverColor, page_style: theme.pageStyle }
      : prev
    )
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
      <div className="flex justify-center items-center gap-2 px-4 pt-2 pb-4 flex-wrap">
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
        {/* Settings gear */}
        <motion.button
          whileHover={{ scale: 1.1, rotate: 30 }} whileTap={{ scale: 0.92 }}
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full
                     bg-white/60 border border-gray-200 text-gray-400 hover:text-gray-600
                     hover:bg-white/80 shadow-sm transition-colors text-base"
          title="Account Settings"
        >
          ⚙️
        </motion.button>
      </div>

      {/* ── Binder tab ─────────────────────────────────────────────── */}
      {activeTab === 'binder' && (
        <>
          {/* Bookshelf row */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {binders.map(b => {
                const isActive = selectedBinder?.id === b.id
                return (
                  <motion.div
                    key={b.id}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className={`flex-shrink-0 flex items-center gap-2 pl-3 pr-2 py-2 rounded-full text-sm
                               font-semibold border shadow-sm transition-all select-none
                               ${isActive
                                 ? 'text-white border-transparent shadow-md'
                                 : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                               }`}
                    style={isActive ? { backgroundColor: b.color ?? '#a78bfa', borderColor: b.color ?? '#a78bfa' } : {}}
                  >
                    {/* Tap label to select */}
                    <button
                      onClick={() => setSelectedBinder(b)}
                      className="flex items-center gap-2 focus:outline-none"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: isActive ? 'rgba(255,255,255,0.7)' : (b.color ?? '#a78bfa') }}
                      />
                      {b.name}
                    </button>
                    {/* Delete × — only shown when > 1 binder exists */}
                    {binders.length > 1 && (
                      <button
                        onClick={() => deleteBinder(b.id)}
                        className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center
                                   text-[10px] leading-none transition-all
                                   ${isActive
                                     ? 'bg-white/25 hover:bg-white/50 text-white'
                                     : 'bg-gray-200/70 hover:bg-red-100 text-gray-400 hover:text-red-500'
                                   }`}
                        title={`Delete "${b.name}"`}
                      >
                        ×
                      </button>
                    )}
                  </motion.div>
                )
              })}

              {/* + New binder */}
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowNewBinder(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm
                           font-semibold border border-dashed border-pink-300 text-pink-400
                           bg-white/50 hover:bg-pink-50 shadow-sm transition-all"
              >
                + New Binder
              </motion.button>
            </div>
          </div>

          {/* Binder view for selected binder */}
          {selectedBinder ? (
            <BinderView
              key={selectedBinder.id}
              items={items.filter(i => i.binder_id === selectedBinder.id)}
              user={user}
              initialTheme={{
                coverColor: selectedBinder.cover_color ?? selectedBinder.color ?? '#a78bfa',
                pageStyle:  selectedBinder.page_style  ?? 'white',
              }}
              onThemeChange={theme => updateBinderTheme(selectedBinder.id, theme)}
            />
          ) : (
            <p className="text-center text-pink-300 font-semibold mt-16 text-sm">
              Create a binder above to get started 📒
            </p>
          )}
        </>
      )}

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

                {/* Move to binder */}
                {binders.length > 0 && (
                  <select
                    value={item.binder_id ?? ''}
                    onChange={e => moveCardToBinder(item.card_id, e.target.value)}
                    className="mt-1.5 w-full text-[10px] text-gray-400 bg-white/60 border border-gray-100
                               rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-pink-200
                               cursor-pointer hover:bg-white/80 transition-colors"
                  >
                    <option value="">📦 No binder</option>
                    {binders.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      </>}  {/* end items.length > 0 */}
      </>)}  {/* end activeTab === 'collection' */}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <AccountSettingsModal
            user={user}
            onToast={onToast}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewBinder && (
          <NewBinderModal
            onSave={createBinder}
            onClose={() => setShowNewBinder(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
