import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import BinderView from './BinderView'

// ─── Pagination ───────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 20

// ─── Price resolution: manual → market → mid → low → 0 ──────────────────────
// manual_price wins when set (user override for cards TCGPlayer hasn't priced yet).
// getDisplayPrice: returns the best numeric value (used in totals, sorts, filters)
function getDisplayPrice(item) {
  return item.manual_price || item.market_price || item.mid_price || item.low_price || 0
}

// getPriceInfo: returns { value, label } so the tile can show source context
// 'Manual' label signals the value is user-entered, not live TCGPlayer data
function getPriceInfo(item) {
  if (item.manual_price) return { value: item.manual_price, label: 'Manual' }
  if (item.market_price) return { value: item.market_price, label: '' }
  if (item.mid_price)    return { value: item.mid_price,    label: 'Mid' }
  if (item.low_price)    return { value: item.low_price,    label: 'Low' }
  return { value: 0, label: '' }
}

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
      className={`stat-card h-full rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${palette[color]}`}
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

// ─── Shared card mini-display used by all three showcase panels ──────────────
function ShowcaseCard({ item, badge, borderColor, delay, onCardClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.08 }}
      transition={{ delay }}
      className="flex flex-col items-center gap-1 cursor-pointer"
      onClick={() => onCardClick?.(item)}
    >
      <div className="relative">
        {badge}
        <img src={item.image} alt={item.name} className={`w-12 rounded-xl shadow-md border-2 ${borderColor}`} />
      </div>
      <p className="text-[10px] font-bold text-gray-600 text-center w-12 truncate">{item.name}</p>
    </motion.div>
  )
}

// ─── Three showcase panels rendered side-by-side ─────────────────────────────
function ShowcasePanels({ ownedItems, allItems, onCardClick }) {
  const top3 = [...ownedItems]
    .filter(i => getDisplayPrice(i) > 0)
    .sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a))
    .slice(0, 3)
  const chaseCards    = allItems.filter(i => i.is_chase)
  const favoriteCards = ownedItems.filter(i => i.is_favorite)

  const hasHighRollers = top3.length > 0
  const hasChase       = chaseCards.length > 0
  const hasFavorites   = favoriteCards.length > 0

  if (!hasHighRollers && !hasChase && !hasFavorites) return null

  const LIMIT = 3

  return (
    <div className="px-4 mb-4 flex gap-3">
      {hasHighRollers && (
        <div className="flex-1 p-3 rounded-2xl border border-yellow-200 bg-gradient-to-b from-yellow-50 to-amber-50 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">👑 High-Rollers</p>
            <span className="text-[9px] font-bold text-amber-400 bg-amber-100 rounded-full px-1.5 py-0.5">
              {top3.length}/{LIMIT}
            </span>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {top3.map((item, i) => (
              <ShowcaseCard
                key={item.card_id}
                item={item}
                borderColor="border-yellow-300"
                delay={i * 0.1}
                badge={i === 0 ? <span className="absolute -top-2 -right-2 text-sm z-10">👑</span> : null}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {hasChase && (
        <div className="flex-1 p-3 rounded-2xl border border-pink-200 bg-gradient-to-b from-pink-50 to-rose-50 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-pink-500 uppercase tracking-wide">🎯 Chase Cards</p>
            <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5
              ${chaseCards.length >= LIMIT ? 'bg-pink-200 text-pink-600' : 'bg-pink-100 text-pink-400'}`}>
              {chaseCards.length}/{LIMIT}
            </span>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {chaseCards.map((item, i) => (
              <ShowcaseCard
                key={item.card_id}
                item={item}
                borderColor="border-pink-300"
                delay={i * 0.1}
                badge={null}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {hasFavorites && (
        <div className="flex-1 p-3 rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-violet-50 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">⭐ Favourites</p>
            <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5
              ${favoriteCards.length >= LIMIT ? 'bg-indigo-200 text-indigo-600' : 'bg-indigo-100 text-indigo-400'}`}>
              {favoriteCards.length}/{LIMIT}
            </span>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {favoriteCards.map((item, i) => (
              <ShowcaseCard
                key={item.card_id}
                item={item}
                borderColor="border-indigo-300"
                delay={i * 0.1}
                badge={null}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pagination bar ───────────────────────────────────────────────────────────
function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  // Show first, last, and up to 3 pages around the current one; insert '…' for gaps
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
          {badge && getDisplayPrice(card) > 0 && (
            <span
              className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none
                         bg-emerald-500/90 text-white rounded px-1 py-0.5"
            >
              ${getDisplayPrice(card).toFixed(2)}
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
      className="rounded-2xl border border-pink-200 bg-white p-4 shadow-sm"
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
              ? `Top card: $${getDisplayPrice(topOwned[0]).toFixed(2)}`
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
        background: 'linear-gradient(135deg, rgba(254,243,199,1) 0%, rgba(253,230,138,0.9) 50%, rgba(252,211,77,0.7) 100%)',
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
function AccountSettingsModal({ user, onToast, onClose, isPublic, toggling, onTogglePublic, refreshing, refreshProgress, onRefreshPrices }) {
  const [username,    setUsername]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passSaving,  setPassSaving]  = useState(false)
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
  async function changePassword() {
    if (newPassword.length < 6) {
      onToast('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPass) {
      onToast('Passwords do not match.')
      return
    }

    setPassSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPassSaving(false)

    if (error) {
      onToast(error.message)
      return
    }

    setNewPassword('')
    setConfirmPass('')
    onToast('Password updated.')
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(255,209,220,0.78)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full"
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

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Change Password
          </label>
          <div className="space-y-2">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-pink-50/60 border border-pink-200 rounded-xl px-3 py-2
                         text-sm text-gray-700 placeholder-gray-300
                         focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <input
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && changePassword()}
              placeholder="Confirm new password"
              minLength={6}
              autoComplete="new-password"
              className="w-full bg-pink-50/60 border border-pink-200 rounded-xl px-3 py-2
                         text-sm text-gray-700 placeholder-gray-300
                         focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={changePassword}
              disabled={passSaving || !newPassword || !confirmPass}
              className="w-full bg-violet-400 hover:bg-violet-500 disabled:opacity-50 text-white
                         font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              {passSaving ? 'Updatingâ€¦' : 'Update Password'}
            </motion.button>
          </div>
        </div>

        {/* Public Profile Toggle */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700">
              {isPublic ? '🔓' : '🔒'} Public Collection
            </p>
            <p className="text-xs text-gray-400 truncate">
              {isPublic ? 'Anyone with your link can view' : 'Your collection is private'}
            </p>
          </div>
          <button
            onClick={onTogglePublic}
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

        {/* Guest View — preview your public profile */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Guest View
          </p>
          {isPublic ? (
            <a
              href={`/share/${user.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-violet-50 hover:bg-violet-100
                         text-violet-600 border border-violet-200 font-semibold text-sm
                         py-2 rounded-xl transition-colors"
            >
              👁 Preview my profile
            </a>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Enable Public Collection above to preview how others see your profile.
            </p>
          )}
        </div>

        {/* Refresh Prices */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Price Data
          </p>
          <p className="text-xs text-gray-400 mb-2">
            Re-fetch market, mid & low prices from TCGPlayer for all your saved cards.
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onRefreshPrices}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100
                       text-emerald-600 border border-emerald-200 font-semibold text-sm
                       py-2 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                  className="inline-block leading-none"
                >
                  ↻
                </motion.span>
                {refreshProgress.total > 0
                  ? `Refreshing… (${refreshProgress.done}/${refreshProgress.total})`
                  : 'Refreshing…'}
              </>
            ) : (
              '↻ Refresh All Prices'
            )}
          </motion.button>
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
  const colorRef           = useRef(null)
  const categoryDebounce   = useRef({})    // rowId → setTimeout handle for debounced DB writes

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
      style={{ background: 'rgba(255,209,220,0.78)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full"
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

// Human-readable labels for TCGPlayer price tier keys
const EDITION_LABELS = {
  'unspecified':        'Unspecified',
  '1stEditionHolofoil': '1st Ed Holofoil',
  '1stEditionNormal':   '1st Ed Normal',
  'holofoil':           'Holofoil',
  'reverseHolofoil':    'Reverse Holofoil',
  'normal':             'Normal',
}
// Ordered list used by dropdowns
const EDITION_OPTIONS = [
  { value: 'unspecified',        label: 'Unspecified' },
  { value: '1stEditionHolofoil', label: '1st Ed Holofoil' },
  { value: '1stEditionNormal',   label: '1st Ed Normal' },
  { value: 'holofoil',           label: 'Holofoil' },
  { value: 'reverseHolofoil',    label: 'Reverse Holofoil' },
  { value: 'normal',             label: 'Normal' },
]
function editionLabel(key) {
  if (!key || key === 'unspecified') return null
  return EDITION_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim()
}

// Language variants — used by "Add another detail" panel
const LANGUAGE_OPTIONS = [
  { value: 'english',    label: 'English',                flag: '🇺🇸' },
  { value: 'japanese',   label: 'Japanese',               flag: '🇯🇵' },
  { value: 'korean',     label: 'Korean',                 flag: '🇰🇷' },
  { value: 'chinese_t',  label: 'Chinese (Traditional)',  flag: '🇹🇼' },
  { value: 'chinese_s',  label: 'Chinese (Simplified)',   flag: '🇨🇳' },
  { value: 'french',     label: 'French',                 flag: '🇫🇷' },
  { value: 'german',     label: 'German',                 flag: '🇩🇪' },
  { value: 'italian',    label: 'Italian',                flag: '🇮🇹' },
  { value: 'spanish',    label: 'Spanish',                flag: '🇪🇸' },
  { value: 'portuguese', label: 'Portuguese',             flag: '🇧🇷' },
  { value: 'thai',       label: 'Thai',                   flag: '🇹🇭' },
  { value: 'indonesian', label: 'Indonesian',             flag: '🇮🇩' },
  { value: 'russian',    label: 'Russian',                flag: '🇷🇺' },
]
const LANGUAGE_FLAG = Object.fromEntries(LANGUAGE_OPTIONS.map(l => [l.value, l.flag]))

// ─── Wishlist card detail modal ───────────────────────────────────────────────
function WishlistCardModal({ item, onClose }) {
  const versionLabel = editionLabel(item.edition)

  // Stored prices with version context in the header
  const rows = [
    item.manual_price && { label: 'Manual (Override)', value: item.manual_price, highlight: true },
    item.market_price && { label: 'Market',            value: item.market_price },
    item.mid_price    && { label: 'Mid',               value: item.mid_price    },
    item.low_price    && { label: 'Low',               value: item.low_price    },
  ].filter(Boolean)

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
        >✕</button>

        <img src={item.image} alt={item.name} className="w-full rounded-2xl mb-4 shadow-md" />

        <h2 className="text-xl font-bold text-pink-500 mb-0.5">{item.name}</h2>
        <p className="text-sm text-gray-400 mb-3">
          {item.owned ? '📦 In your Collection' : '💖 On your Wishlist'}
        </p>

        {rows.length > 0 && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-pink-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">
              {versionLabel
                ? <><span className="text-pink-500 font-bold">{versionLabel}</span> · Stored Prices</>
                : 'Stored Prices'}
            </p>
            {rows.map(({ label, value, highlight }) => (
              <div key={label} className={`flex justify-between items-center px-3 py-2 text-sm ${highlight ? 'bg-violet-50' : 'bg-white'}`}>
                <span className={highlight ? 'text-violet-600 font-medium' : 'text-gray-500'}>{label}</span>
                <span className={`font-bold ${highlight ? 'text-violet-600' : 'text-pink-600'}`}>${Number(value).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <a
          href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(item.name)}`}
          target="_blank"
          rel="noreferrer"
          className="block text-center bg-pink-400 hover:bg-pink-500 text-white
                     font-semibold py-2 rounded-2xl transition-colors"
        >
          View on TCGPlayer
        </a>
      </motion.div>
    </motion.div>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────────────
export default function WishlistDashboard({ user, onToast, onGoExplore, onBinderChange, initialTab = 'collection', onCardRemoved, onOwnedChanged }) {
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isPublic,  setIsPublic]  = useState(false)
  const [toggling,  setToggling]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [activeTab,        setActiveTab]        = useState(initialTab)  // 'collection' | 'wishlist' | 'binder' | 'trainers' | 'followers'
  const [followedTrainers, setFollowedTrainers] = useState([])
  const [followers,        setFollowers]        = useState([])  // users who follow me
  // 1st Edition is determined by card_id suffix ("-1st") — no toggle, no runtime Sets needed

  // ── Binder state ──────────────────────────────────────────────────────────
  const [binders,         setBinders]         = useState([])
  const [selectedBinder,  setSelectedBinder]  = useState(null)  // { id, name, color, coverColor, pageStyle }
  const [showNewBinder,   setShowNewBinder]   = useState(false)
  const [renamingId,      setRenamingId]      = useState(null)  // binder id currently being renamed
  const [renameInput,     setRenameInput]     = useState('')
  const [showSettings,    setShowSettings]    = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ done: 0, total: 0 })
  const [editingPriceId,  setEditingPriceId]  = useState(null)   // row id being manually priced
  const [manualInput,     setManualInput]     = useState('')
  const [addingDetailFor,   setAddingDetailFor]   = useState(null) // row id showing the add-detail panel
  const [pendingNewLanguage, setPendingNewLanguage] = useState('')

  // Tracks the current slotsPerPage of the active BinderView (reported via callback).
  // Used by computeNextBinderSlot and handleInsertPage to stay consistent with the display.
  const binderSlotsPerPage = useRef(9)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [collectionPage, setCollectionPage] = useState(1)
  const [wishlistPage,   setWishlistPage]   = useState(1)
  const [cardSearch,     setCardSearch]     = useState('')
  const [cardSort,       setCardSort]       = useState('newest')  // 'newest' | 'oldest'
  const [categoryFilter, setCategoryFilter] = useState(null)      // null = all, string = specific category

  // Notify App whenever the active binder changes (so CardGrid can route new cards here)
  useEffect(() => { onBinderChange?.(selectedBinder?.id ?? null) }, [selectedBinder])

  const shareUrl = `${window.location.origin}/share/${user?.id}`

  async function fetchWishlist() {
    if (!user) return

    // Single round-trip: wishlist + profile + follow IDs + binders + followers + blocks all at once
    const [wishlist, { data: prof }, followData, { data: binderData }, followersData] = await Promise.all([
      fetchAllRows(() =>
        supabase
          .from('wishlists')
          // edition column: run migration before this works →
          //   ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS edition TEXT NOT NULL DEFAULT 'unlimited';
          .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, slot_index, binder_id, edition, is_chase, is_favorite, quantity, category, language')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ),
      supabase
        .from('profiles')
        .select('is_public')
        .eq('id', user.id)
        .maybeSingle(),
      fetchAllRows(() =>
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .order('created_at', { ascending: false })
      ),
      supabase
        .from('binders')
        .select('id, name, color, cover_color, page_style')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      fetchAllRows(() =>
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
      ),
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
      const [{ data: followedProfiles }, followedCards] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username')
          .in('id', followedIds),
        fetchAllRows(() =>
          supabase
            .from('wishlists')
            .select('user_id, card_id, name, image, market_price, owned, created_at')
            .in('user_id', followedIds)
            .order('created_at', { ascending: false })
        ),
      ])

      // Group all fetched cards by user (already ordered by created_at DESC from DB)
      const cardsByUser = {}
      for (const card of (followedCards ?? [])) {
        if (!cardsByUser[card.user_id]) cardsByUser[card.user_id] = []
        cardsByUser[card.user_id].push(card)
      }

      // Re-sort profiles to match followedIds order (newest follow first)
      const profileById = Object.fromEntries((followedProfiles ?? []).map(p => [p.id, p]))
      setFollowedTrainers(
        followedIds
          .map(id => profileById[id])
          .filter(Boolean)
          .map(p => {
            const all = cardsByUser[p.id] ?? []
            const topOwned = all
              .filter(c => c.owned)
              .sort((a, b) => (b.market_price ?? 0) - (a.market_price ?? 0))
              .slice(0, 3)
            const topWishlist = all
              .filter(c => !c.owned)
              .slice(0, 3)
            return { ...p, topOwned, topWishlist }
          })
      )
    } else {
      setFollowedTrainers([])
    }

    // Fetch profiles for users who follow me
    const followerIds = (followersData ?? []).map(f => f.follower_id)
    if (followerIds.length > 0) {
      const { data: followerProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', followerIds)
      setFollowers(followerProfiles ?? [])
    } else {
      setFollowers([])
    }

    setLoading(false)
  }

  useEffect(() => { fetchWishlist() }, [user])

  // ── Derived arrays + totals — all useMemo, all before early returns (Rules of Hooks).
  const ownedItemsList    = useMemo(() => items.filter(i =>  i.owned), [items])
  const wishlistItemsList = useMemo(() => items.filter(i => !i.owned), [items])
  const totalCount        = items.length
  const ownedCount        = ownedItemsList.length
  const wishlistCount     = wishlistItemsList.length
  // Collection Value: strictly owned === true cards only, multiplied by quantity
  const collectionValue = useMemo(
    () => ownedItemsList.reduce((acc, i) => acc + getDisplayPrice(i) * (i.quantity || 1), 0),
    [ownedItemsList]
  )
  // Wishlist Value: strictly owned === false cards only
  const wishlistValue = useMemo(
    () => wishlistItemsList.reduce((acc, i) => acc + getDisplayPrice(i), 0),
    [wishlistItemsList]
  )

  // Search-filtered + sorted views
  // Items are fetched created_at DESC (newest first); 'oldest' just reverses that slice.
  // All unique non-empty categories across the full list (for filter pills)
  const allCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean))
    return [...cats].sort()
  }, [items])

  const filteredOwnedItems = useMemo(() => {
    const q = cardSearch.trim().toLowerCase()
    let filtered = q ? ownedItemsList.filter(i => i.name?.toLowerCase().includes(q)) : ownedItemsList
    if (categoryFilter) filtered = filtered.filter(i => i.category === categoryFilter)
    return cardSort === 'oldest' ? [...filtered].reverse() : filtered
  }, [ownedItemsList, cardSearch, cardSort, categoryFilter])

  const filteredWishlistItems = useMemo(() => {
    const q = cardSearch.trim().toLowerCase()
    let filtered = q ? wishlistItemsList.filter(i => i.name?.toLowerCase().includes(q)) : wishlistItemsList
    if (categoryFilter) filtered = filtered.filter(i => i.category === categoryFilter)
    return cardSort === 'oldest' ? [...filtered].reverse() : filtered
  }, [wishlistItemsList, cardSearch, cardSort, categoryFilter])

  function updateCategory(rowId, category) {
    // Keep raw value in state (preserves spaces while typing)
    const rawVal = category === '' ? null : category
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, category: rawVal } : i))
    // Debounce DB write: only persist after 600ms of quiet, and trim only for storage
    clearTimeout(categoryDebounce.current[rowId])
    categoryDebounce.current[rowId] = setTimeout(() => {
      const dbVal = category?.trim() || null
      supabase.from('wishlists').update({ category: dbVal }).eq('id', rowId)
    }, 600)
  }

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

  // ── Price tier extractor ─────────────────────────────────────────────────────
  // Checks preferred tier names first; falls back to ANY tier that has a market
  // price, intentionally skipping 1stEdition* keys for unlimited lookups.
  // ── Refresh Prices — pull latest prices from tcg_prices (our Supabase DB) ────
  // Single batch query instead of per-card API calls — fast and no rate limits.
  async function refreshPrices() {
    if (refreshing) return
    setRefreshing(true)
    setRefreshProgress({ done: 0, total: 0 })

    // Fetch all wishlist rows for this user
    const { data: wishlistItems, error: fetchErr } = await supabase
      .from('wishlists')
      .select('id, card_id')
      .eq('user_id', user.id)

    if (fetchErr || !wishlistItems?.length) {
      onToast('Nothing to refresh.')
      setRefreshing(false)
      return
    }

    // Collect unique base card IDs (strip -1st suffix for the DB lookup)
    const uniqueBaseIds = [...new Set(wishlistItems.map(i => i.card_id.replace(/-1st$/, '')))]

    // Batch fetch ALL prices in one round-trip
    const { data: priceRows } = await supabase
      .from('tcg_prices')
      .select('card_id, holofoil_market, holofoil_mid, holofoil_low, normal_market, normal_mid, normal_low, reverse_holo_market, first_ed_holo_market, first_ed_normal_market, other_market, other_mid, other_low')
      .in('card_id', uniqueBaseIds)

    if (!priceRows?.length) {
      onToast('Price data not available yet — run the import script first 📦')
      setRefreshing(false)
      return
    }

    // Build price lookup map: base card_id → price row
    const priceMap = Object.fromEntries(priceRows.map(p => [p.card_id, p]))

    const total = wishlistItems.length
    setRefreshProgress({ done: 0, total })
    let updated = 0

    for (const item of wishlistItems) {
      const is1st  = item.card_id.endsWith('-1st')
      const baseId = is1st ? item.card_id.replace(/-1st$/, '') : item.card_id
      const p      = priceMap[baseId]

      if (!p) {
        setRefreshProgress(prev => ({ ...prev, done: prev.done + 1 }))
        continue
      }

      // Unlimited: prefer holofoil → normal → reverse holo → other (e.g. Perfect Order)
      const unlMarket = p.holofoil_market ?? p.normal_market ?? p.reverse_holo_market ?? p.other_market ?? null
      const unlMid    = p.holofoil_mid    ?? p.normal_mid    ?? p.other_mid    ?? null
      const unlLow    = p.holofoil_low    ?? p.normal_low    ?? p.other_low    ?? null

      let market, mid, low
      if (is1st) {
        // 1st Ed: use 1st Ed market, fall back to unlimited for mid/low (not stored separately)
        market = p.first_ed_holo_market ?? p.first_ed_normal_market ?? unlMarket
        mid    = unlMid
        low    = unlLow
      } else {
        market = unlMarket
        mid    = unlMid
        low    = unlLow
      }

      const { error } = await supabase
        .from('wishlists')
        .update({ market_price: market, mid_price: mid, low_price: low })
        .eq('id', item.id)

      if (!error) updated++
      setRefreshProgress(prev => ({ ...prev, done: prev.done + 1 }))
    }

    setRefreshing(false)
    setRefreshProgress({ done: 0, total: 0 })

    if (updated > 0) {
      await fetchWishlist()
      onToast(`✨ Updated ${updated}/${total} card price${total !== 1 ? 's' : ''}!`)
    } else {
      onToast('All prices are already up to date ✅')
    }
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      onToast('Share link copied! ✨')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  async function handleShare() {
    // Use the native share sheet on mobile/supported browsers; fall back to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Poképop Collection ✨',
          text:  'Check out my Pokémon TCG collection!',
          url:   shareUrl,
        })
      } catch (err) {
        // User dismissed the sheet — not an error worth surfacing
        if (err.name !== 'AbortError') copyShareLink()
      }
    } else {
      copyShareLink()
    }
  }

  async function toggleOwned(rowId, cardId, currentOwned) {
    const newOwned = !currentOwned
    // Move the item to the front of the list so it appears at the top of
    // the "newest first" sort in whichever tab it lands in.
    setItems(prev => {
      const target  = prev.find(i => i.id === rowId)
      if (!target) return prev
      const rest    = prev.filter(i => i.id !== rowId)
      return [{ ...target, owned: newOwned }, ...rest]
    })
    const { error } = await supabase
      .from('wishlists')
      .update({ owned: newOwned })
      .eq('id', rowId)
    if (error) {
      // Revert: move back to original position is hard, just restore the flag
      setItems(prev => prev.map(i => i.id === rowId ? { ...i, owned: currentOwned } : i))
    } else {
      onOwnedChanged?.(cardId, newOwned)
      onToast(newOwned ? 'Added to Collection! ✨📦' : 'Moved back to Wishlist 💖')
    }
  }

  async function updateQuantity(rowId, cardId, delta) {
    const row = items.find(i => i.id === rowId)
    if (!row) return
    const next = Math.max(1, (row.quantity || 1) + delta)
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, quantity: next } : i))
    await supabase
      .from('wishlists')
      .update({ quantity: next })
      .eq('id', rowId)
  }

  async function saveManualPrice(rowId) {
    const num = parseFloat(manualInput)
    const value = (!isNaN(num) && num > 0) ? num : null
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, manual_price: value } : i))
    setEditingPriceId(null)
    setManualInput('')
    await supabase
      .from('wishlists')
      .update({ manual_price: value })
      .eq('id', rowId)
  }

  async function updateEdition(rowId, newEdition) {
    const val = newEdition || 'unspecified'
    // Conflict check: another row for this card already has this edition
    const existing = items.find(i => i.id !== rowId && i.card_id === items.find(r => r.id === rowId)?.card_id && i.edition === val)
    if (existing) { onToast('You already have that edition saved for this card!'); return }
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, edition: val } : i))
    await supabase
      .from('wishlists')
      .update({ edition: val })
      .eq('id', rowId)
  }

  async function addDetail(item, newLanguage) {
    if (!newLanguage || newLanguage === 'english') { onToast('Please select a language variant to add'); return }
    // Check: same card + same language + same edition already exists
    const conflict = items.find(i => i.id !== item.id && i.card_id === item.card_id && i.language === newLanguage && i.edition === item.edition)
    if (conflict) { onToast('You already have that language variant saved!'); return }

    const { data, error } = await supabase
      .from('wishlists')
      .insert({
        user_id:      user.id,
        card_id:      item.card_id,
        name:         item.name,
        image:        item.image,
        owned:        item.owned,
        edition:      item.edition,
        language:     newLanguage,
        quantity:     1,
        market_price: null,
        mid_price:    null,
        low_price:    null,
      })
      .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, slot_index, binder_id, edition, is_chase, is_favorite, quantity, category, language')
      .single()
    if (error) {
      onToast('Failed to add language variant')
      return
    }
    setItems(prev => [data, ...prev])
    setAddingDetailFor(null)
    setPendingNewLanguage('')
    const lang = LANGUAGE_OPTIONS.find(l => l.value === newLanguage)
    onToast(`${lang?.flag ?? ''} ${lang?.label ?? newLanguage} variant added! ✨`)
  }

  async function toggleChase(rowId, currentVal) {
    const newVal = !currentVal
    if (newVal && items.filter(i => i.is_chase).length >= 3) {
      onToast('Max 3 chase cards! Remove one first 🎯')
      return
    }
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, is_chase: newVal } : i))
    await supabase
      .from('wishlists')
      .update({ is_chase: newVal })
      .eq('id', rowId)
  }

  async function toggleFavorite(rowId, currentVal) {
    const newVal = !currentVal
    if (newVal && items.filter(i => i.is_favorite).length >= 3) {
      onToast('Max 3 favourites! Remove one first ⭐')
      return
    }
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, is_favorite: newVal } : i))
    await supabase
      .from('wishlists')
      .update({ is_favorite: newVal })
      .eq('id', rowId)
  }

  async function removeFollower(followerId) {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user.id)
    setFollowers(prev => prev.filter(f => f.id !== followerId))
    onToast('Follower removed ✓')
  }

  async function blockUser(targetId) {
    await Promise.all([
      supabase.from('follows').delete()
        .eq('follower_id', targetId).eq('following_id', user.id),
      supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: targetId }),
    ])
    setFollowers(prev => prev.filter(f => f.id !== targetId))
    onToast('User blocked 🚫')
  }

  async function removeCard(item) {
    const otherEditionsExist = items.some(i => i.id !== item.id && i.card_id === item.card_id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('wishlists').delete().eq('id', item.id)
    if (!otherEditionsExist) onCardRemoved?.(item.card_id)
    onToast('Removed ✕')
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

  async function renameBinder(binderId, newName) {
    const trimmed = newName.trim()
    if (!trimmed) return
    // Optimistic update
    setBinders(prev => prev.map(b => b.id === binderId ? { ...b, name: trimmed } : b))
    setSelectedBinder(prev => prev?.id === binderId ? { ...prev, name: trimmed } : prev)
    setRenamingId(null)
    await supabase
      .from('binders')
      .update({ name: trimmed })
      .eq('id', binderId)
      .eq('user_id', user.id)
    onToast(`Binder renamed to "${trimmed}" ✏️`)
  }

  // Called by BinderView whenever cards are swapped so items state stays current.
  // Without this, moveCardToBinder would read stale slot_indices and mis-place cards.
  function handleSlotsSwapped(swaps) {
    setItems(prev => prev.map(item => {
      const swap = swaps.find(s => s.id === item.id)
      return swap ? { ...item, slot_index: swap.slot_index } : item
    }))
  }

  // Called by BinderView when the user clicks "Insert page above/below page N".
  // Shifts slot_index of all cards on pages >= threshold by +slotsPerPage so
  // that an empty page appears at the requested position.
  async function handleInsertPage(pageNumber, direction) {
    const SLOTS_PER_PAGE = binderSlotsPerPage.current
    // 'before' shifts page N onwards; 'after' shifts page N+1 onwards
    const threshold = direction === 'before'
      ? (pageNumber - 1) * SLOTS_PER_PAGE
      : pageNumber * SLOTS_PER_PAGE

    const binderId = selectedBinder?.id
    if (!binderId) return

    const affected = items.filter(
      i => i.binder_id === binderId && i.owned && (i.slot_index ?? 0) >= threshold
    )
    if (!affected.length) return

    // Optimistic update
    setItems(prev => prev.map(i => {
      const hit = affected.find(a => a.id === i.id)
      return hit ? { ...i, slot_index: (hit.slot_index ?? 0) + SLOTS_PER_PAGE } : i
    }))

    // Persist all shifts
    await Promise.all(affected.map(i =>
      supabase.from('wishlists')
        .update({ slot_index: (i.slot_index ?? 0) + SLOTS_PER_PAGE })
        .eq('id', i.id)
    ))
    onToast(`Blank page inserted ${direction === 'before' ? 'before' : 'after'} page ${pageNumber} 📄`)
  }

  // Swaps two adjacent pages' worth of cards (pageNumber ↔ pageNumber±1).
  async function handleMovePage(pageNumber, direction) {
    const spp      = binderSlotsPerPage.current
    const binderId = selectedBinder?.id
    if (!binderId) return

    const pageA = pageNumber
    const pageB = direction === 'up' ? pageNumber - 1 : pageNumber + 1
    if (pageB < 1) return

    const slotA_start = (pageA - 1) * spp
    const slotA_end   = pageA * spp - 1
    const slotB_start = (pageB - 1) * spp
    const slotB_end   = pageB * spp - 1

    const all     = items.filter(i => i.binder_id === binderId && i.owned)
    const onPageA = all.filter(i => {
      const s = i.slot_index ?? 0
      return s >= slotA_start && s <= slotA_end
    })
    const onPageB = all.filter(i => {
      const s = i.slot_index ?? 0
      return s >= slotB_start && s <= slotB_end
    })

    if (!onPageA.length && !onPageB.length) return

    const delta = (pageB - pageA) * spp  // positive = moving page A forward
    const updates = [
      ...onPageA.map(i => ({ id: i.id, slot_index: (i.slot_index ?? 0) + delta })),
      ...onPageB.map(i => ({ id: i.id, slot_index: (i.slot_index ?? 0) - delta })),
    ]

    // Optimistic update
    setItems(prev => prev.map(i => {
      const u = updates.find(u => u.id === i.id)
      return u ? { ...i, slot_index: u.slot_index } : i
    }))

    await Promise.all(updates.map(u =>
      supabase.from('wishlists').update({ slot_index: u.slot_index }).eq('id', u.id)
    ))
    onToast(`Page ${pageA} moved ${direction} 📄`)
  }

  // Mirror of BinderView's buildSlotArray logic — must stay in sync.
  // Returns the index of the first visually empty slot so new cards land in the
  // correct position without conflicting with existing placements.
  function computeNextBinderSlot(ownedBinderItems) {
    const spp    = binderSlotsPerPage.current  // synced from BinderView via onSlotsPerPageChange
    const n      = ownedBinderItems.length
    if (n === 0) return 0

    // Use the same totalSlots logic as buildSlotArray in BinderView
    const maxSlot    = ownedBinderItems.reduce((m, i) => Math.max(m, i.slot_index ?? 0), 0)
    const minNeeded  = Math.max(n, maxSlot + 1)
    const totalPages = Math.max(1, Math.ceil(minNeeded / spp))
    const totalSlots = totalPages * spp

    const occupied = new Array(totalSlots).fill(false)
    const unplaced = []

    for (const item of ownedBinderItems) {
      const idx = item.slot_index
      if (idx != null && idx >= 0 && idx < totalSlots && !occupied[idx]) {
        occupied[idx] = true
      } else {
        unplaced.push(item)
      }
    }

    let cursor = 0
    for (const _ of unplaced) {
      while (cursor < totalSlots && occupied[cursor]) cursor++
      if (cursor < totalSlots) { occupied[cursor] = true; cursor++ }
    }

    const firstEmpty = occupied.indexOf(false)
    // All slots full → extend into the first slot of the next page
    return firstEmpty === -1 ? totalSlots : firstEmpty
  }

  async function moveCardToBinder(rowId, binderId) {
    const prev = items.find(i => i.id === rowId)
    const prev_binder = prev?.binder_id
    const prev_slot   = prev?.slot_index

    let nextSlot = null
    if (binderId) {
      // Only owned cards — BinderView filters by i.owned, so nextSlot must
      // be computed from the same subset to avoid off-by-N placement errors.
      const ownedBinder = items.filter(i => i.binder_id === binderId && i.id !== rowId && i.owned)
      nextSlot = computeNextBinderSlot(ownedBinder)
    }

    setItems(cur => cur.map(i => i.id === rowId
      ? { ...i, binder_id: binderId || null, slot_index: nextSlot }
      : i
    ))
    const { error } = await supabase
      .from('wishlists')
      .update({ binder_id: binderId || null, slot_index: nextSlot })
      .eq('id', rowId)
    if (error) {
      setItems(cur => cur.map(i => i.id === rowId ? { ...i, binder_id: prev_binder, slot_index: prev_slot } : i))
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

  // ── Shared card tile — used by both Collection and Wishlist grids ────────────
  const renderTile = (item) => (
    <motion.div
      key={item.id}
      layout
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`rounded-2xl overflow-hidden shadow-md relative ${item.owned ? 'tile-owned' : 'tile-wishlist'}`}
    >
      <button
        onClick={() => removeCard(item)}
        className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/70
                   text-gray-400 hover:text-red-400 hover:bg-white text-xs leading-none
                   flex items-center justify-center shadow-sm transition-colors"
        title="Remove this edition"
      >✕</button>

      <div className="relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-full cursor-pointer"
          loading="lazy"
          onClick={() => setSelectedItem(item)}
        />
        {item.owned && (item.quantity || 1) > 1 && (
          <span className="absolute bottom-1.5 right-1.5 text-[11px] font-bold bg-emerald-500 text-white
                           px-1.5 py-0.5 rounded-full shadow leading-none">
            ×{item.quantity}
          </span>
        )}
      </div>

      <div className="p-2 text-center">
        <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>

        {(() => {
          const { value: p, label } = getPriceInfo(item)
          const is1st     = item.card_id?.endsWith('-1st')
          const hasMarket = !!item.market_price
          const isEditing = editingPriceId === item.id

          if (isEditing) {
            return (
              <div className="flex items-center gap-1 mb-1 px-1">
                <span className="text-xs text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveManualPrice(item.id)
                    if (e.key === 'Escape') { setEditingPriceId(null); setManualInput('') }
                  }}
                  autoFocus
                  placeholder="0.00"
                  className="w-full text-xs text-center border border-pink-200 rounded-lg px-1.5 py-1
                             focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white/80"
                />
                <button
                  onClick={() => saveManualPrice(item.id)}
                  className="text-emerald-500 hover:text-emerald-600 text-sm font-bold leading-none flex-shrink-0"
                  title="Save"
                >✓</button>
              </div>
            )
          }

          return (
            <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
              {p > 0 ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${label === 'Manual'
                    ? 'text-violet-600 bg-violet-100'
                    : 'text-pink-600 bg-pink-100'
                  }`}>
                  ${p.toFixed(2)}{label ? ` (${label})` : ''}
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full">
                  {is1st ? '1st Ed — Checking…' : '---'}
                </span>
              )}
              {is1st && p > 0 && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
                  1st Ed
                </span>
              )}
              {/* Pencil — always visible so users can override any price (including leaked 1st Ed prices) */}
              {(() => {
                const hasOverride = !!item.manual_price
                const startVal = item.manual_price
                  ? String(item.manual_price)
                  : p > 0 ? p.toFixed(2) : ''
                return (
                <button
                  onClick={() => { setEditingPriceId(item.id); setManualInput(startVal) }}
                  className={`transition-colors leading-none ${hasOverride ? 'text-violet-400 hover:text-violet-600' : 'text-gray-300 hover:text-pink-400'}`}
                  title={hasOverride ? 'Edit your price override' : 'Set a manual price'}
                >
                  ✏️
                </button>
                )
              })()}
            </div>
          )
        })()}

        {item.card_id?.endsWith('-1st') && (
          <span className="inline-block text-[10px] font-bold bg-amber-400 text-white
                           border border-amber-500 px-2 py-0.5 rounded-full mb-1 shadow-sm">
            ⭐ 1st Edition
          </span>
        )}

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => toggleOwned(item.id, item.card_id, item.owned)}
          className={`w-full text-xs font-semibold py-1.5 rounded-xl transition-all mt-1
            ${item.owned
              ? 'bg-emerald-400 text-white hover:bg-emerald-500'
              : 'bg-white/70 text-gray-400 hover:bg-pink-50 hover:text-pink-500 border border-gray-200'
            }`}
        >
          {item.owned ? '✅ I own this!' : '🌸 I own this'}
        </motion.button>

        {item.owned && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <button
              onClick={() => updateQuantity(item.id, item.card_id, -1)}
              disabled={(item.quantity || 1) <= 1}
              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500
                         font-bold text-sm leading-none transition-colors disabled:opacity-30"
            >−</button>
            <span className="text-xs font-bold text-gray-600 min-w-[1.5rem] text-center">
              {item.quantity || 1}
            </span>
            <button
              onClick={() => updateQuantity(item.id, item.card_id, 1)}
              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-emerald-100 text-gray-500
                         hover:text-emerald-600 font-bold text-sm leading-none transition-colors"
            >+</button>
          </div>
        )}

        {/* Chase — wishlist cards only */}
        {!item.owned && (() => {
          const chaseCount  = items.filter(i => i.is_chase).length
          const chaseAtMax  = !item.is_chase && chaseCount >= 3
          return (
            <motion.button
              whileTap={chaseAtMax ? {} : { scale: 0.92 }}
              onClick={() => toggleChase(item.id, item.is_chase)}
              disabled={chaseAtMax}
              className={`w-full text-xs font-semibold py-1 rounded-xl transition-all mt-1
                ${item.is_chase
                  ? 'bg-pink-100 text-pink-500 hover:bg-pink-200 border border-pink-300'
                  : chaseAtMax
                    ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed opacity-50'
                    : 'bg-white/70 text-gray-300 hover:bg-pink-50 hover:text-pink-400 border border-gray-200'
                }`}
              title={item.is_chase ? 'Remove from chase cards' : chaseAtMax ? 'Max 3 chase cards reached' : 'Mark as a chase card (max 3)'}
            >
              {item.is_chase ? '🎯 Chasing!' : chaseAtMax ? '🎯 Full (3/3)' : '🎯 Chase'}
            </motion.button>
          )
        })()}

        {/* Favourite — owned collection cards only */}
        {item.owned && (() => {
          const favCount   = items.filter(i => i.is_favorite).length
          const favAtMax   = !item.is_favorite && favCount >= 3
          return (
            <motion.button
              whileTap={favAtMax ? {} : { scale: 0.92 }}
              onClick={() => toggleFavorite(item.id, item.is_favorite)}
              disabled={favAtMax}
              className={`w-full text-xs font-semibold py-1 rounded-xl transition-all mt-1
                ${item.is_favorite
                  ? 'bg-indigo-100 text-indigo-500 hover:bg-indigo-200 border border-indigo-300'
                  : favAtMax
                    ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed opacity-50'
                    : 'bg-white/70 text-gray-300 hover:bg-indigo-50 hover:text-indigo-400 border border-gray-200'
                }`}
              title={item.is_favorite ? 'Remove from favourites' : favAtMax ? 'Max 3 favourites reached' : 'Add to favourites (max 3)'}
            >
              {item.is_favorite ? '⭐ Favourite!' : favAtMax ? '⭐ Full (3/3)' : '⭐ Favourite'}
            </motion.button>
          )
        })()}

        {/* Edition + Language details ─────────────────────────────────── */}
        {(() => {
          // Language flag badge (shown above edition if not english)
          const lang    = item.language ?? 'english'
          const flag    = lang !== 'english' ? (LANGUAGE_FLAG[lang] ?? '🌐') : null
          // Which language variants of this card already exist (to avoid duplicates)
          const takenLangs = new Set(
            items.filter(i => i.card_id === item.card_id && i.edition === item.edition).map(i => i.language ?? 'english')
          )
          const availableLangs = LANGUAGE_OPTIONS.filter(l => !takenLangs.has(l.value))
          const isAddingHere   = addingDetailFor === item.id

          return (
            <div className="mt-2">
              {/* Language flag pill */}
              {flag && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                                 bg-blue-50 text-blue-500 border border-blue-200
                                 px-2 py-0.5 rounded-full mb-1">
                  {flag} {LANGUAGE_OPTIONS.find(l => l.value === lang)?.label}
                </span>
              )}

              {/* Edition dropdown */}
              <select
                value={item.edition ?? 'unspecified'}
                onChange={e => updateEdition(item.id, e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-2 py-1.5
                           bg-white/80 text-gray-500 focus:outline-none focus:ring-1 focus:ring-pink-300"
              >
                {EDITION_OPTIONS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>

              {/* Add another detail — language variant */}
              {availableLangs.length > 0 && (
                isAddingHere ? (
                  <div className="mt-1.5 flex gap-1">
                    <select
                      value={pendingNewLanguage}
                      onChange={e => setPendingNewLanguage(e.target.value)}
                      className="flex-1 text-xs border border-pink-200 rounded-xl px-2 py-1.5
                                 bg-white/90 text-gray-600 focus:outline-none focus:ring-1 focus:ring-pink-300"
                    >
                      <option value="">Pick language…</option>
                      {availableLangs.map(l => (
                        <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => addDetail(item, pendingNewLanguage)}
                      className="px-2 py-1.5 rounded-xl bg-pink-400 text-white text-xs font-bold
                                 hover:bg-pink-500 transition-colors flex-shrink-0"
                    >Add</button>
                    <button
                      onClick={() => { setAddingDetailFor(null); setPendingNewLanguage('') }}
                      className="px-2 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-bold
                                 hover:bg-gray-200 transition-colors flex-shrink-0"
                      title="Cancel"
                    >✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingDetailFor(item.id); setPendingNewLanguage('') }}
                    className="mt-1.5 w-full text-xs text-center font-semibold
                               py-1.5 rounded-xl border border-dashed border-violet-300
                               text-violet-400 hover:text-violet-600 hover:bg-violet-50
                               hover:border-violet-400 transition-all"
                  >
                    🌐 Add language variant
                  </button>
                )
              )}
            </div>
          )
        })()}

        {item.owned && binders.length > 0 ? (
          <select
            value={item.binder_id ?? ''}
            onChange={e => moveCardToBinder(item.id, e.target.value)}
            className="mt-2 w-full text-sm font-bold text-white border-2 border-violet-500
                       rounded-xl px-3 py-2.5 cursor-pointer transition-all
                       focus:outline-none focus:ring-2 focus:ring-violet-400 hover:border-violet-400"
            style={{ background: 'linear-gradient(135deg, #4c1d95, #5b21b6)' }}
          >
            <option value="" style={{ background: '#1e1b4b' }}>📦 No binder</option>
            {binders.map(b => (
              <option key={b.id} value={b.id} style={{ background: '#1e1b4b' }}>{b.name}</option>
            ))}
          </select>
        ) : !item.owned ? (
          <p className="mt-1.5 text-[10px] text-center text-violet-400 font-medium tracking-wide">
            💖 Wishlisted
          </p>
        ) : null}

        {/* Category tag input */}
        <div className="mt-2">
          <input
            type="text"
            list={`cats-${item.id}`}
            value={item.category ?? ''}
            onChange={e => updateCategory(item.id, e.target.value)}
            placeholder="+ Add category…"
            className="w-full text-xs border border-gray-200 rounded-xl px-2 py-1.5
                       bg-white/80 text-gray-500 placeholder-gray-300
                       focus:outline-none focus:ring-1 focus:ring-violet-300"
          />
          {allCategories.length > 0 && (
            <datalist id={`cats-${item.id}`}>
              {allCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          )}
        </div>
      </div>
    </motion.div>
  )

  return (
    <>
      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className="flex justify-center items-center gap-2 px-4 pt-2 pb-4 flex-wrap">
        {[
          {
            id:       'cards',
            label:    'My Cards 📦',
            isActive: activeTab === 'collection' || activeTab === 'wishlist',
            action:   () => { if (activeTab !== 'collection' && activeTab !== 'wishlist') { setActiveTab('collection') } setCollectionPage(1); setWishlistPage(1) },
          },
          {
            id:       'binder',
            label:    'Virtual Binder 📒',
            isActive: activeTab === 'binder',
            action:   () => { setActiveTab('binder'); setCollectionPage(1); setWishlistPage(1) },
          },
          {
            id:       'trainers',
            label:    `Following 👥${followedTrainers.length ? ` · ${followedTrainers.length}` : ''}`,
            isActive: activeTab === 'trainers',
            action:   () => { setActiveTab('trainers'); setCollectionPage(1); setWishlistPage(1) },
          },
          {
            id:       'followers',
            label:    `Followers 🫂${followers.length ? ` · ${followers.length}` : ''}`,
            isActive: activeTab === 'followers',
            action:   () => { setActiveTab('followers'); setCollectionPage(1); setWishlistPage(1) },
          },
        ].map(tab => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={tab.action}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border shadow-sm
              ${tab.isActive
                ? 'bg-pink-400 text-white border-pink-400 shadow-pink-200'
                : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
              }`}
          >
            {tab.label}
          </motion.button>
        ))}
        {/* Share Collection button — only visible when profile is public */}
        {isPublic && (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                       bg-violet-400 hover:bg-violet-500 text-white rounded-full
                       shadow-sm transition-colors"
          >
            ↗ Share
          </motion.button>
        )}

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

      {/* ── Shared stats + HighRollers (collection & wishlist tabs only) ── */}
      {(activeTab === 'collection' || activeTab === 'wishlist') && items.length > 0 && <>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <StatCard icon="📦" label="Collection Value" value={collectionValue} color="mint"  prefix="$" decimals={2} />
          <StatCard icon="✨" label="Wishlist Value"    value={wishlistValue}   color="lilac" prefix="$" decimals={2} />
          <StatCard icon="💖" label="Total Cards"       value={totalCount}      color="pink"  />
          <StatCard icon="✅" label="Collection Progress" value={totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0} color="lilac" suffix="%" />
        </div>
        <ShowcasePanels ownedItems={ownedItemsList} allItems={items} onCardClick={setSelectedItem} />
      </>}

      {/* ── Collection / Wishlist sub-nav ──────────────────────────── */}
      {(activeTab === 'collection' || activeTab === 'wishlist') && (
        <div className="px-4 pt-1 pb-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setActiveTab('collection'); setCollectionPage(1) }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold
                         border transition-all shadow-sm
                         ${activeTab === 'collection'
                           ? 'bg-emerald-400 text-white border-emerald-400'
                           : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                         }`}
            >
              📦 Collection
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none
                ${activeTab === 'collection' ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                {ownedCount}
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setActiveTab('wishlist'); setWishlistPage(1) }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold
                         border transition-all shadow-sm
                         ${activeTab === 'wishlist'
                           ? 'bg-violet-400 text-white border-violet-400'
                           : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                         }`}
            >
              ✨ Wishlist
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none
                ${activeTab === 'wishlist' ? 'bg-white/30 text-white' : 'bg-violet-100 text-violet-600'}`}>
                {wishlistCount}
              </span>
            </motion.button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={cardSearch}
              onChange={e => { setCardSearch(e.target.value); setCollectionPage(1); setWishlistPage(1) }}
              placeholder={`Search ${activeTab === 'collection' ? 'collection' : 'wishlist'}…`}
              className="w-full pl-8 pr-8 py-2 text-sm rounded-full border border-gray-200
                         bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300
                         placeholder-gray-300 text-gray-600 transition-all"
            />
            {cardSearch && (
              <button
                onClick={() => setCardSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500
                           text-xs leading-none transition-colors"
              >✕</button>
            )}
          </div>

          {/* Sort toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--app-text)', opacity: 0.6 }}>Sort:</span>
            {[
              { id: 'newest', label: 'Newest first' },
              { id: 'oldest', label: 'Oldest first' },
            ].map(opt => (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setCardSort(opt.id); setCollectionPage(1); setWishlistPage(1) }}
                className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all
                  ${cardSort === opt.id
                    ? 'bg-pink-400 text-white border-pink-400'
                    : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                  }`}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>

          {/* Category filter pills — only show when categories exist */}
          {allCategories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium" style={{ color: 'var(--app-text)', opacity: 0.6 }}>Category:</span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setCategoryFilter(null); setCollectionPage(1); setWishlistPage(1) }}
                className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all
                  ${!categoryFilter
                    ? 'bg-sky-400 text-white border-sky-400'
                    : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                  }`}
              >
                All
              </motion.button>
              {allCategories.map(cat => (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setCategoryFilter(categoryFilter === cat ? null : cat); setCollectionPage(1); setWishlistPage(1) }}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all
                    ${categoryFilter === cat
                      ? 'bg-violet-400 text-white border-violet-400'
                      : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                    }`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Binder tab ─────────────────────────────────────────────── */}
      {activeTab === 'binder' && (
        <>
          {/* Bookshelf row */}
          <div className="px-4 mb-6">
            <div className="flex items-center justify-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              {binders.map(b => {
                const isActive = selectedBinder?.id === b.id
                const col      = b.color ?? '#a78bfa'
                return (
                  <motion.div
                    key={b.id}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className={`flex-shrink-0 flex items-center gap-2.5 pl-5 pr-2.5 py-2.5
                               font-bold text-base rounded-full border-2 transition-all select-none`}
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
                    {/* Color dot + name / inline rename input */}
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm cursor-pointer"
                      style={{ background: isActive ? 'rgba(255,255,255,0.8)' : col }}
                      onClick={() => setSelectedBinder(b)}
                    />

                    {renamingId === b.id ? (
                      <input
                        autoFocus
                        value={renameInput}
                        onChange={e => setRenameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  renameBinder(b.id, renameInput)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => renameBinder(b.id, renameInput || b.name)}
                        className="w-28 bg-white/30 text-white placeholder-white/60 text-sm font-bold
                                   rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-white/60"
                      />
                    ) : (
                      <button
                        onClick={() => setSelectedBinder(b)}
                        className="focus:outline-none truncate max-w-[120px]"
                      >
                        {b.name}
                      </button>
                    )}

                    {/* Pencil rename — active binder only */}
                    {isActive && renamingId !== b.id && (
                      <button
                        onClick={() => { setRenamingId(b.id); setRenameInput(b.name) }}
                        className="w-6 h-6 rounded-full flex items-center justify-center
                                   bg-white/20 hover:bg-white/40 text-white text-xs transition-all"
                        title="Rename binder"
                      >
                        ✏️
                      </button>
                    )}

                    {/* Delete × */}
                    {binders.length > 1 && renamingId !== b.id && (
                      <button
                        onClick={() => deleteBinder(b.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center
                                   text-lg font-bold leading-none transition-all
                                   ${isActive
                                     ? 'bg-white/20 hover:bg-red-500/80 text-white'
                                     : 'bg-gray-100 hover:bg-red-500/20 text-gray-400 hover:text-red-500'
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
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowNewBinder(true)}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5
                           font-bold text-base rounded-full border-2 border-dashed border-pink-300
                           text-pink-400 bg-white/50 hover:bg-pink-50 hover:border-pink-400 transition-all"
              >
                + New Binder
              </motion.button>
            </div>
          </div>

          {/* Binder view for selected binder */}
          {selectedBinder ? (
            <BinderView
              key={selectedBinder.id}
              items={items.filter(i => i.owned && i.binder_id === selectedBinder.id)}
              user={user}
              initialTheme={{
                coverColor: selectedBinder.cover_color ?? selectedBinder.color ?? '#a78bfa',
                pageStyle:  selectedBinder.page_style  ?? 'white',
              }}
              onThemeChange={theme => updateBinderTheme(selectedBinder.id, theme)}
              binders={binders}
              onTransfer={moveCardToBinder}
              currentBinderId={selectedBinder.id}
              onCardClick={setSelectedItem}
              onSlotsSwapped={handleSlotsSwapped}
              onRemoveFromCollection={removeCard}
              onInsertPage={handleInsertPage}
              onMovePage={handleMovePage}
              onSlotsPerPageChange={spp => { binderSlotsPerPage.current = spp }}
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

      {/* ── Followers tab ─────────────────────────────────────────── */}
      {activeTab === 'followers' && (
        <div className="max-w-2xl mx-auto px-4 pb-16">
          {followers.length === 0 ? (
            <div className="flex flex-col items-center text-center mt-16 gap-3">
              <p className="text-5xl">🫂</p>
              <p className="font-bold text-lg" style={{ color: 'var(--app-accent)' }}>
                No followers yet
              </p>
              <p className="text-sm" style={{ color: 'var(--app-text)', opacity: 0.7 }}>
                Share your collection link so other trainers can follow you!
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {followers.map(follower => {
                const initial = follower.username?.[0]?.toUpperCase() ?? '?'
                const shareUrl = `${window.location.origin}/share/${follower.id}`
                return (
                  <motion.div
                    key={follower.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-2xl border p-3 shadow-sm"
                    style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center
                                 text-white font-bold text-sm"
                      style={{ background: 'linear-gradient(135deg, #f9a8d4, #a78bfa)' }}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>
                        {follower.username ?? 'Unknown Trainer'}
                      </p>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline"
                        style={{ color: 'var(--app-accent-soft)' }}
                      >
                        View profile →
                      </a>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => removeFollower(follower.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
                                   bg-white/60 hover:bg-gray-100 text-gray-500 hover:text-gray-700 border-gray-200"
                        title="Remove follower"
                      >
                        Remove
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => blockUser(follower.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors
                                   bg-white/60 hover:bg-red-50 text-red-400 hover:text-red-600 border-red-200"
                        title="Block this user"
                      >
                        Block
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
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

      {/* ── 📦 My Collection ────────────────────────────────────────── */}
      {ownedItemsList.length > 0 && (() => {
        if (filteredOwnedItems.length === 0) return (
          <p className="text-center text-gray-300 font-semibold mt-8 mb-4">
            No cards match "{cardSearch}" ✨
          </p>
        )
        const totalColPages   = Math.ceil(filteredOwnedItems.length / ITEMS_PER_PAGE)
        const collectionSlice = filteredOwnedItems.slice(
          (collectionPage - 1) * ITEMS_PER_PAGE,
          collectionPage * ITEMS_PER_PAGE
        )
        return (
          <>
            <motion.div
              key={`col-page-${collectionPage}-${cardSearch}`}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              <AnimatePresence>{collectionSlice.map(renderTile)}</AnimatePresence>
            </motion.div>
            <PaginationBar
              currentPage={collectionPage}
              totalPages={totalColPages}
              onPageChange={p => { setCollectionPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
          </>
        )
      })()}

      </>}  {/* end items.length > 0 */}
      </>)}  {/* end activeTab === 'collection' */}

      {/* ── Wishlist tab ───────────────────────────────────────────── */}
      {activeTab === 'wishlist' && (
        <div className="max-w-6xl mx-auto pb-16">
          {wishlistItemsList.length === 0 ? (
            <div className="text-center mt-16 px-4">
              <p className="text-violet-300 font-semibold text-lg mb-4">
                Your wishlist is empty! Start adding cards you want! 💜
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
          ) : (() => {
            if (filteredWishlistItems.length === 0) return (
              <p className="text-center text-gray-300 font-semibold mt-8 mb-4">
                No cards match "{cardSearch}" 💜
              </p>
            )
            const totalWishPages = Math.ceil(filteredWishlistItems.length / ITEMS_PER_PAGE)
            const wishlistSlice  = filteredWishlistItems.slice(
              (wishlistPage - 1) * ITEMS_PER_PAGE,
              wishlistPage * ITEMS_PER_PAGE
            )
            return (
              <>
                <motion.div
                  key={`wish-page-${wishlistPage}-${cardSearch}`}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
                  initial="hidden" animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                >
                  <AnimatePresence>{wishlistSlice.map(renderTile)}</AnimatePresence>
                </motion.div>
                <PaginationBar
                  currentPage={wishlistPage}
                  totalPages={totalWishPages}
                  onPageChange={p => { setWishlistPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </>
            )
          })()}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <AccountSettingsModal
            user={user}
            onToast={onToast}
            onClose={() => setShowSettings(false)}
            isPublic={isPublic}
            toggling={toggling}
            onTogglePublic={togglePublic}
            refreshing={refreshing}
            refreshProgress={refreshProgress}
            onRefreshPrices={refreshPrices}
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

      <AnimatePresence>
        {selectedItem && (
          <WishlistCardModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}


