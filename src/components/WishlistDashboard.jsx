import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import CardLists from './CardLists'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import BinderView from './BinderView'
import PackLogModal from './PackLogModal'

// ─── Pagination ───────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 20

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Card back fallback (inline SVG, never 404s) ─────────────────────────────
const CARD_BACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect width="250" height="350" fill="#1a56cc" rx="14"/><rect x="8" y="8" width="234" height="334" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" rx="10"/><circle cx="125" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="5"/><circle cx="125" cy="175" r="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="3"/><line x1="47" y1="175" x2="203" y2="175" stroke="rgba(255,255,255,0.22)" stroke-width="4"/><circle cx="125" cy="175" r="15" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.18)" stroke-width="2"/><circle cx="125" cy="175" r="9" fill="#1a56cc"/></svg>')}`

// ─── Price resolution: manual → market → mid → low → 0 ──────────────────────
// manual_price wins when set (user override for cards TCGPlayer hasn't priced yet).
// getDisplayPrice: returns the best numeric value (used in totals, sorts, filters)
function getDisplayPrice(item) {
  return item.manual_price || item.market_price || item.mid_price || item.low_price || 0
}

// getPriceInfo: returns { value, label } so the tile can show source context
// 'Manual' label signals the value is user-entered, not live TCGPlayer data
function getPriceInfo(item) {
  if (item.manual_price) return { value: item.manual_price, label: 'Manual',   source: null }
  if (item.market_price) return { value: item.market_price, label: '',         source: item.price_source ?? null }
  if (item.mid_price)    return { value: item.mid_price,    label: 'Mid',      source: null }
  if (item.low_price)    return { value: item.low_price,    label: 'Low',      source: null }
  return { value: 0, label: '', source: null }
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
function StatCard({ label, value, prefix = '', suffix = '', decimals = 0, color = 'pink', icon, onClick }) {
  const animated = useCountUp(value)
  const display  = decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()

  const palette = {
    pink:  'from-pink-100/80 to-rose-100/60 border-pink-200',
    blue:  'from-sky-100/80 to-blue-100/60 border-blue-200',
    mint:  'from-emerald-100/80 to-teal-100/60 border-emerald-200',
    lilac: 'from-violet-100/80 to-purple-100/60 border-purple-200',
  }

  const Tag = onClick ? motion.button : motion.div

  return (
    <Tag
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.03 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={`stat-card h-full rounded-2xl border bg-gradient-to-br p-3 shadow-sm ${palette[color]}
                  ${onClick ? 'cursor-pointer w-full text-left' : ''}`}
    >
      <p className="text-xl mb-0.5">{icon}</p>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
      <p className="text-lg font-bold text-gray-700 leading-tight">
        {prefix}{display}{suffix}
      </p>
      {onClick && <p className="text-[9px] text-gray-300 mt-0.5">tap to view</p>}
    </Tag>
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
        <img src={item.image} alt={item.name} className={`w-12 rounded-xl shadow-md border-2 ${borderColor}`}
             onError={e => { e.currentTarget.src = CARD_BACK }} />
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
function MiniCardRow({ cards, emptyColor = 'pink', badge, onCardClick }) {
  return (
    <div className="flex gap-1.5">
      {cards.map(card => (
        <div
          key={card.card_id}
          className={`flex-1 relative ${onCardClick ? 'cursor-pointer' : ''}`}
          onClick={() => onCardClick?.(card)}
        >
          <img
            src={card.image}
            alt={card.name}
            className="w-full rounded-lg shadow-sm hover:opacity-90 transition-opacity"
            loading="lazy"
            onError={e => { e.currentTarget.src = CARD_BACK }}
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

function TrainerCard({ trainer, onCardClick }) {
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
              ? `Highest-Value Card: $${getDisplayPrice(topOwned[0]).toFixed(2)}`
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

      {/* Highest Value */}
      <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-1.5">
        🏆 Highest Value
      </p>
      <MiniCardRow cards={topOwned} emptyColor="emerald" badge onCardClick={onCardClick} />

      {/* Recently Wishlisted */}
      <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide mt-3 mb-1.5">
        💜 Recently Wishlisted
      </p>
      <MiniCardRow cards={topWishlist} emptyColor="pink" onCardClick={onCardClick} />
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
      className="block support-card rounded-2xl p-4 shadow-sm border border-amber-200 no-underline"
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

        {/* Sign Out */}
        <div className="mb-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100
                       text-gray-500 border border-gray-200 font-semibold text-sm
                       py-2 rounded-xl transition-colors"
          >
            ← Sign Out
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

// Card condition grades (TCG standard)
const CONDITION_OPTIONS = [
  { value: '',                  label: 'Condition…' },
  { value: 'near_mint',         label: 'Near Mint' },
  { value: 'lightly_played',    label: 'Lightly Played' },
  { value: 'moderately_played', label: 'Moderately Played' },
  { value: 'heavily_played',    label: 'Heavily Played' },
  { value: 'damaged',           label: 'Damaged' },
]

// ─── Wishlist card detail modal ───────────────────────────────────────────────
function WishlistCardModal({
  item, onClose, onSaveTags,
  user, onToast,
  onEditionChange, onConditionChange,
  onMoveToWishlist, onSold, onTraded,
  onToggleFavorite, favAtMax,
}) {
  const versionLabel = editionLabel(item.edition)
  const [tagInput,  setTagInput]  = useState('')
  const [localTags, setLocalTags] = useState(item.tags ?? [])
  const [sellMode,      setSellMode]      = useState(false)
  const [sellPrice,     setSellPrice]     = useState('')
  const [sellSaving,    setSellSaving]    = useState(false)
  const [tradeConfirm,  setTradeConfirm]  = useState(false)
  const [tradeSaving,   setTradeSaving]   = useState(false)
  const [movingBack,    setMovingBack]    = useState(false)
  const [suggestedPrice, setSuggestedPrice] = useState(null)

  useEffect(() => {
    supabase.rpc('get_suggested_price', { p_card_id: item.card_id }).then(({ data }) => {
      if (data?.[0]) setSuggestedPrice(data[0])
    })
  }, [item.card_id]) // eslint-disable-line react-hooks/exhaustive-deps

  function addTag() {
    const t = tagInput.trim()
    if (!t || localTags.includes(t)) { setTagInput(''); return }
    const next = [...localTags, t]
    setLocalTags(next)
    setTagInput('')
    onSaveTags?.(item.id, next)
  }

  function removeTag(tag) {
    const next = localTags.filter(t => t !== tag)
    setLocalTags(next)
    onSaveTags?.(item.id, next)
  }

  async function handleSell() {
    const price = parseFloat(sellPrice)
    if (isNaN(price) || price < 0) { onToast?.('Enter a valid sale price'); return }
    setSellSaving(true)
    await supabase.from('card_sales').insert({
      user_id:    user.id,
      card_id:    item.card_id,
      card_name:  item.name,
      card_image: item.image,
      sale_price: price,
    })
    await supabase.from('wishlists').delete().eq('id', item.id)
    setSellSaving(false)
    onSold?.(item, price)
    onToast?.('Card sold! 💰')
    onClose()
  }

  async function handleTrade() {
    setTradeSaving(true)
    await supabase.from('card_trades').insert({
      user_id:    user.id,
      card_id:    item.card_id,
      card_name:  item.name,
      card_image: item.image,
    })
    await supabase.from('wishlists').delete().eq('id', item.id)
    setTradeSaving(false)
    onTraded?.(item)
    onToast?.('Card traded! 🤝')
    onClose()
  }

  async function handleMoveToWishlist() {
    setMovingBack(true)
    await supabase.from('wishlists').update({ owned: false }).eq('id', item.id)
    setMovingBack(false)
    onMoveToWishlist?.(item.id)
    onToast?.('Moved back to Wishlist 💖')
    onClose()
  }

  // Stored prices with version context in the header
  const isEbayPrice = item.price_source === 'ebay'
  const rows = [
    item.manual_price && { label: 'Manual (Override)', value: item.manual_price, highlight: true },
    item.market_price && { label: isEbayPrice ? 'Market (avg. 10 eBay sales)' : 'Market', value: item.market_price, ebay: isEbayPrice },
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
        {/* ── Favourite star — top-left, opposite the ✕ ── */}
        {item.owned && (
          <button
            onClick={() => !favAtMax && onToggleFavorite?.(item.id, item.is_favorite)}
            disabled={favAtMax && !item.is_favorite}
            className={`absolute top-4 left-4 z-10 w-8 h-8 rounded-full flex items-center
                       justify-center text-sm shadow-sm transition-all leading-none
                       ${item.is_favorite
                         ? 'bg-indigo-400 text-white'
                         : favAtMax
                           ? 'bg-white/70 text-gray-200 cursor-not-allowed'
                           : 'bg-white/70 text-gray-300 hover:bg-indigo-100 hover:text-indigo-400'
                       }`}
            title={item.is_favorite ? 'Remove from favourites' : favAtMax ? 'Max 3 favourites' : 'Add to favourites'}
          >
            {item.is_favorite ? '★' : '☆'}
          </button>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/70 hover:bg-white
                     text-gray-400 hover:text-gray-600 flex items-center justify-center
                     shadow-sm transition-colors text-base leading-none"
          aria-label="Close"
        >✕</button>

        <img src={item.image} alt={item.name} className="w-full rounded-2xl mb-4 shadow-md"
             onError={e => { e.currentTarget.src = CARD_BACK }} />

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
            {rows.map(({ label, value, highlight, ebay }) => (
              <div key={label} className={`flex justify-between items-center px-3 py-2 text-sm
                ${highlight ? 'bg-violet-50' : ebay ? 'bg-amber-50' : 'bg-white'}`}>
                <span className={highlight ? 'text-violet-600 font-medium' : ebay ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                  {label}
                </span>
                <span className={`font-bold ${highlight ? 'text-violet-600' : ebay ? 'text-amber-700' : 'text-pink-600'}`}>
                  ${Number(value).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Community Suggested Price ── */}
        {suggestedPrice && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-emerald-100 bg-emerald-50">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-2.5">
              <div>
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                  Community Price
                </p>
                <p className="text-[10px] text-emerald-500 normal-case">
                  median of {suggestedPrice.contributor_count} trainer{suggestedPrice.contributor_count !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-xl font-bold text-emerald-700">
                ${Number(suggestedPrice.median_price).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* ── Rarity / Edition ─────────────────────────────────────────── */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Rarity / Edition
          </p>
          <select
            value={item.edition ?? 'unspecified'}
            onChange={e => onEditionChange?.(item.id, e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2
                       bg-white/80 text-gray-600 focus:outline-none focus:ring-1 focus:ring-pink-300"
          >
            {EDITION_OPTIONS.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        {/* ── Condition — owned cards only ─────────────────────────────── */}
        {item.owned && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Condition
            </p>
            <select
              value={item.condition ?? ''}
              onChange={e => onConditionChange?.(item.id, e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2
                         bg-white/80 text-gray-600 focus:outline-none focus:ring-1 focus:ring-pink-300"
            >
              {CONDITION_OPTIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Tags ─────────────────────────────────────────────────────── */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            🏷️ Tags
          </p>
          {localTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {localTags.map(tag => (
                <span key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                             bg-rose-100 text-rose-600 text-xs font-semibold"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-rose-400 hover:text-rose-600 leading-none text-[10px] font-bold ml-0.5"
                    aria-label={`Remove tag ${tag}`}
                  >✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Add a tag…"
              className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1.5
                         focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-200"
            />
            <button
              onClick={addTag}
              disabled={!tagInput.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-400 text-white
                         disabled:opacity-40 hover:bg-rose-500 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* ── Owned-card actions ────────────────────────────────────────── */}
        {item.owned && (
          <div className="flex flex-col gap-2 mb-4">
            {!sellMode && !tradeConfirm && (
              <>
                <button
                  onClick={handleMoveToWishlist}
                  disabled={movingBack}
                  className="border border-violet-200 text-violet-500 hover:bg-violet-50
                             font-semibold py-2 rounded-2xl transition-colors text-sm disabled:opacity-60"
                >
                  {movingBack ? '…' : '↩ Move back to Wishlist'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSellMode(true)}
                    className="flex-1 border border-amber-200 text-amber-600 hover:bg-amber-50
                               font-semibold py-2 rounded-2xl transition-colors text-sm"
                  >
                    💰 Sell
                  </button>
                  <button
                    onClick={() => setTradeConfirm(true)}
                    className="flex-1 border border-sky-200 text-sky-600 hover:bg-sky-50
                               font-semibold py-2 rounded-2xl transition-colors text-sm"
                  >
                    🤝 Trade
                  </button>
                </div>
              </>
            )}

            {sellMode && (
              <div className="flex flex-col gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <p className="text-xs font-semibold text-amber-700">Sale price (USD)</p>
                <input
                  type="number" min="0" step="0.01"
                  value={sellPrice}
                  onChange={e => setSellPrice(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSell() }}
                  placeholder="e.g. 24.99"
                  autoFocus
                  className="text-sm border border-amber-200 rounded-xl px-3 py-1.5
                             focus:outline-none focus:border-amber-400 bg-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSellMode(false); setSellPrice('') }}
                    className="flex-1 border border-gray-200 text-gray-400 hover:bg-gray-50
                               font-semibold py-1.5 rounded-xl text-sm transition-colors"
                  >Cancel</button>
                  <button
                    onClick={handleSell}
                    disabled={sellSaving}
                    className="flex-1 bg-amber-400 hover:bg-amber-500 text-white
                               font-semibold py-1.5 rounded-xl text-sm transition-colors disabled:opacity-60"
                  >{sellSaving ? '…' : 'Confirm Sale'}</button>
                </div>
              </div>
            )}

            {tradeConfirm && (
              <div className="flex flex-col gap-2 p-3 bg-sky-50 rounded-2xl border border-sky-200">
                <p className="text-xs font-semibold text-sky-700">Mark as traded?</p>
                <p className="text-[11px] text-gray-400">This will remove the card from your collection.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTradeConfirm(false)}
                    className="flex-1 border border-gray-200 text-gray-400 hover:bg-gray-50
                               font-semibold py-1.5 rounded-xl text-sm transition-colors"
                  >Cancel</button>
                  <button
                    onClick={handleTrade}
                    disabled={tradeSaving}
                    className="flex-1 bg-sky-400 hover:bg-sky-500 text-white
                               font-semibold py-1.5 rounded-xl text-sm transition-colors disabled:opacity-60"
                  >{tradeSaving ? '…' : 'Yes, Traded!'}</button>
                </div>
              </div>
            )}
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
export default function WishlistDashboard({ user, profile, onToast, onGoExplore, onOpenScanner, onBinderChange, initialTab = 'collection', onCardRemoved, onOwnedChanged, onCardAdded }) {
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isPublic,  setIsPublic]  = useState(false)
  const [toggling,  setToggling]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [activeTab,        setActiveTab]        = useState(initialTab)  // 'collection' | 'wishlist' | 'binder' | 'lists' | 'trainers' | 'followers'
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
  const [pendingNewImageUrl, setPendingNewImageUrl] = useState('')

  // Quick-add from empty binder slot
  const [quickAddSlot,      setQuickAddSlot]      = useState(null)   // globalIdx or null
  const [quickAddSearch,    setQuickAddSearch]    = useState('')
  // Stable callback so BinderView's useCallback doesn't recreate handleSlotClick on every render
  const handleEmptySlotClick = useCallback(slot => {
    setQuickAddSlot(slot)
    setQuickAddSearch('')
  }, [])

  // Tracks the current slotsPerPage of the active BinderView (reported via callback).
  // Used by computeNextBinderSlot and handleInsertPage to stay consistent with the display.
  const binderSlotsPerPage = useRef(9)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [collectionPage, setCollectionPage] = useState(1)
  const [wishlistPage,   setWishlistPage]   = useState(1)
  const [cardSearch,     setCardSearch]     = useState('')
  const [cardSort,       setCardSort]       = useState('newest')  // 'newest' | 'oldest'
  const [showDupes,      setShowDupes]      = useState(true)   // true = one tile per copy; false = one tile per card
  const [virtualSlots,   setVirtualSlots]   = useState({})     // virtualCopyId → slot_index (persists across re-renders)
  const [tagFilter,     setTagFilter]     = useState(null)  // null = all, string = specific tag
  const [showTagMenu,   setShowTagMenu]   = useState(false) // tag filter accordion open/closed
  const [trainerSearch, setTrainerSearch] = useState('')    // filter text in Following tab
  const [followInput,   setFollowInput]   = useState('')    // username to follow
  const [followStatus,  setFollowStatus]  = useState(null)  // null | 'searching' | 'found' | 'notfound' | 'already' | 'self'
  const [followResult,  setFollowResult]  = useState(null)  // { id, username } if found
  const [tileTagInputs, setTileTagInputs] = useState({})    // rowId → current inline tag input value
  const [soldModal,     setSoldModal]     = useState(null)  // item object when active
  const [tradeModal,    setTradeModal]    = useState(null)  // item object when active
  const [soldPrice,     setSoldPrice]     = useState('')
  const [salesTotal,    setSalesTotal]    = useState(0)
  const [tradeCount,    setTradeCount]    = useState(0)
  const [salesHistory,       setSalesHistory]       = useState([])
  const [tradesHistory,      setTradesHistory]      = useState([])
  const [salesHistoryOpen,   setSalesHistoryOpen]   = useState(false)
  const [tradesHistoryOpen,  setTradesHistoryOpen]  = useState(false)
  const [selectedFollowedCard, setSelectedFollowedCard] = useState(null)
  const [packInvested,   setPackInvested]   = useState(0)      // sum of all pack prices
  const [packLogs,       setPackLogs]       = useState([])     // recent pack log history
  const [packLogOpen,    setPackLogOpen]    = useState(false)  // history modal open
  const [packModalOpen,  setPackModalOpen]  = useState(false)  // log-a-pack modal open
  const [historyCard,    setHistoryCard]    = useState(null)   // card preview from pack history
  const [tradeDropdownId, setTradeDropdownId] = useState(null) // rowId with trade/sale dropdown open
  const [showSocialsMenu, setShowSocialsMenu] = useState(false) // mobile Socials dropdown open
  const [feedItems,       setFeedItems]       = useState([])    // social feed activity
  const [feedLoading,     setFeedLoading]     = useState(false)

  // Close trade dropdown when clicking outside
  useEffect(() => {
    if (!tradeDropdownId) return
    const close = () => setTradeDropdownId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [tradeDropdownId])

  // Close Socials menu when clicking outside
  useEffect(() => {
    if (!showSocialsMenu) return
    const close = () => setShowSocialsMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showSocialsMenu])

  // Notify App whenever the active binder changes (so CardGrid can route new cards here)
  useEffect(() => { onBinderChange?.(selectedBinder?.id ?? null) }, [selectedBinder])

  // Persist virtual slot positions to localStorage so they survive page refreshes and
  // binder switches. Key includes userId + binderId so each binder has its own map.
  // Reset to {} when showDupes toggles (virtual IDs are mode-specific).
  useEffect(() => { setVirtualSlots({}) }, [showDupes])
  useEffect(() => {
    if (!user?.id || !selectedBinder?.id) { setVirtualSlots({}); return }
    const key = `pokepop_vslots_${user.id}_${selectedBinder.id}`
    try {
      const stored = localStorage.getItem(key)
      setVirtualSlots(stored ? JSON.parse(stored) : {})
    } catch { setVirtualSlots({}) }
  }, [user?.id, selectedBinder?.id])
  useEffect(() => {
    if (!user?.id || !selectedBinder?.id) return
    const key = `pokepop_vslots_${user.id}_${selectedBinder.id}`
    try { localStorage.setItem(key, JSON.stringify(virtualSlots)) } catch {}
  }, [virtualSlots, user?.id, selectedBinder?.id])

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
          .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, price_source, slot_index, binder_id, edition, is_chase, is_favorite, quantity, language, tags, condition, category')
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

    // Enrich wishlist items with set_name + number from tcg_cards (single batch lookup)
    const rawItems = wishlist ?? []
    const cardIds  = [...new Set(rawItems.map(i => i.card_id).filter(Boolean))]
    if (cardIds.length) {
      const { data: metaRows } = await supabase
        .from('tcg_cards')
        .select('id, set_name, number')
        .in('id', cardIds)
      if (metaRows?.length) {
        const metaMap = Object.fromEntries(metaRows.map(r => [r.id, r]))
        setItems(rawItems.map(i => ({
          ...i,
          set_name:    metaMap[i.card_id]?.set_name    ?? null,
          card_number: metaMap[i.card_id]?.number      ?? null,
        })))
      } else {
        setItems(rawItems)
      }
    } else {
      setItems(rawItems)
    }
    setIsPublic(prof?.is_public ?? false)

    // Fetch sales and trade totals
    const [{ data: salesData }, { data: tradesData }] = await Promise.all([
      supabase.from('card_sales').select('sale_price').eq('user_id', user.id),
      supabase.from('card_trades').select('id').eq('user_id', user.id),
    ])
    setSalesTotal((salesData ?? []).reduce((acc, s) => acc + (s.sale_price ?? 0), 0))
    setTradeCount((tradesData ?? []).length)

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

    // Pack investment total
    const { data: packData } = await supabase
      .from('pack_logs')
      .select('id, pack_name, opened_at, pack_price, total_value, cards, store')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
    const logs = packData ?? []
    setPackLogs(logs)
    setPackInvested(logs.reduce((sum, p) => sum + (p.pack_price || 0), 0))

    setLoading(false)
  }

  useEffect(() => { fetchWishlist() }, [user])

  // Fetch social feed when tab is opened
  useEffect(() => {
    if (activeTab !== 'socialfeed' || !user) return
    if (feedItems.length) return // already loaded
    let cancelled = false
    setFeedLoading(true)
    async function loadFeed() {
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      if (cancelled) return
      const ids = (followRows ?? []).map(f => f.following_id)
      if (!ids.length) { setFeedLoading(false); return }
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids)
      const profileMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]))
      const [{ data: cards }, { data: packs }] = await Promise.all([
        supabase.from('wishlists')
          .select('card_id, name, image, owned, created_at, user_id')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('pack_logs')
          .select('id, user_id, pack_name, opened_at, cards')
          .in('user_id', ids)
          .order('opened_at', { ascending: false })
          .limit(20),
      ])
      if (cancelled) return
      const cardItems = (cards ?? []).map(w => ({
        id: `${w.user_id}-${w.card_id}-${w.created_at}`,
        type: 'card',
        username: profileMap[w.user_id]?.username ?? 'Trainer',
        action: w.owned ? 'added to collection' : 'wishlisted',
        cardName: w.name ?? w.card_id,
        cardImage: w.image,
        time: w.created_at,
      }))
      const packItems = (packs ?? []).map(log => ({
        id: `pack-${log.id}`,
        type: 'pack',
        username: profileMap[log.user_id]?.username ?? 'Trainer',
        packName: log.pack_name,
        hasHit: (log.cards ?? []).some(c => (c.market_price || 0) >= 5),
        time: log.opened_at,
      }))
      const merged = [...cardItems, ...packItems]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 50)
      setFeedItems(merged)
      setFeedLoading(false)
    }
    loadFeed()
    return () => { cancelled = true }
  }, [activeTab, user])

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
  // All unique tags across all wishlist/collection items (for tag filter pills)
  const allTags = useMemo(() => {
    const tags = new Set(items.flatMap(i => i.tags ?? []).filter(Boolean))
    return [...tags].sort()
  }, [items])

  // All unique tags the user has created across their whole collection — for autocomplete
  const allUserTags = useMemo(() => {
    const tags = new Set(items.flatMap(i => i.tags ?? []).filter(Boolean))
    return [...tags].sort()
  }, [items])

  const filteredOwnedItems = useMemo(() => {
    const q = cardSearch.trim().toLowerCase()
    let filtered = q ? ownedItemsList.filter(i => i.name?.toLowerCase().includes(q)) : ownedItemsList
    if (tagFilter) filtered = filtered.filter(i => (i.tags ?? []).includes(tagFilter))
    return cardSort === 'oldest' ? [...filtered].reverse() : filtered
  }, [ownedItemsList, cardSearch, cardSort, tagFilter])

  // Expand each owned item by its quantity so that quantity=3 shows as 3 tiles.
  // _isExpanded: true → this tile is one physical copy of a multi-copy row.
  const expandedOwnedItems = useMemo(() =>
    filteredOwnedItems.flatMap(item => {
      const qty = item.quantity || 1
      if (qty <= 1) return [{ ...item, _key: item.id, _copyIndex: 1, _totalCopies: 1, _isExpanded: false }]
      return Array.from({ length: qty }, (_, i) => ({
        ...item,
        _key:         `${item.id}-copy-${i}`,
        _copyIndex:   i + 1,
        _totalCopies: qty,
        _isExpanded:  true,
      }))
    }),
  [filteredOwnedItems])

  // Total physical copies across all owned rows (used in the Collection tab badge)
  const totalCopies = useMemo(
    () => ownedItemsList.reduce((acc, i) => acc + (i.quantity || 1), 0),
    [ownedItemsList]
  )

  // collectionDisplayItems: expanded when showDupes ON, one tile per row when OFF
  const collectionDisplayItems = useMemo(() =>
    showDupes
      ? expandedOwnedItems
      : filteredOwnedItems.map(item => ({ ...item, _key: item.id, _copyIndex: 1, _totalCopies: 1, _isExpanded: false })),
  [showDupes, expandedOwnedItems, filteredOwnedItems])

  // binderDisplayItems: raw binder items expanded by quantity when showDupes ON
  const binderRawItems = useMemo(() =>
    items.filter(i => i.owned && i.binder_id === selectedBinder?.id),
  [items, selectedBinder?.id])

  const binderValue = useMemo(() =>
    binderRawItems.reduce((sum, item) => sum + getDisplayPrice(item) * (item.quantity || 1), 0),
  [binderRawItems])

  const binderDisplayItems = useMemo(() => {
    if (!showDupes) return binderRawItems
    return binderRawItems.flatMap(item => {
      const qty = item.quantity || 1
      if (qty <= 1) return [{ ...item, _sourceId: item.id, _copyIndex: 0, _totalCopies: 1, _isExpanded: false }]
      return Array.from({ length: qty }, (_, i) => {
        const copyId = i === 0 ? item.id : `${item.id}-copy-${i}`
        return {
          ...item,
          id:           copyId,
          slot_index:   i === 0 ? item.slot_index : (virtualSlots[copyId] ?? null),
          _sourceId:    item.id,
          _copyIndex:   i,
          _totalCopies: qty,
          _isExpanded:  true,
        }
      })
    })
  }, [binderRawItems, showDupes, virtualSlots])

  const filteredWishlistItems = useMemo(() => {
    const q = cardSearch.trim().toLowerCase()
    let filtered = q ? wishlistItemsList.filter(i => i.name?.toLowerCase().includes(q)) : wishlistItemsList
    if (tagFilter) filtered = filtered.filter(i => (i.tags ?? []).includes(tagFilter))
    return cardSort === 'oldest' ? [...filtered].reverse() : filtered
  }, [wishlistItemsList, cardSearch, cardSort, tagFilter])

  async function saveTags(rowId, tags) {
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, tags } : i))
    await supabase.from('wishlists').update({ tags }).eq('id', rowId)
  }

  async function saveCondition(rowId, condition) {
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, condition } : i))
    await supabase.from('wishlists').update({ condition: condition || null }).eq('id', rowId)
  }

  async function openSalesHistory() {
    const { data } = await supabase
      .from('card_sales')
      .select('id, card_id, card_name, card_image, sale_price, sold_at')
      .eq('user_id', user.id)
      .order('sold_at', { ascending: false })
    setSalesHistory(data ?? [])
    setSalesHistoryOpen(true)
  }

  async function openTradesHistory() {
    const { data } = await supabase
      .from('card_trades')
      .select('id, card_id, card_name, card_image, traded_at')
      .eq('user_id', user.id)
      .order('traded_at', { ascending: false })
    setTradesHistory(data ?? [])
    setTradesHistoryOpen(true)
  }

  async function deleteSaleRecord(id, price) {
    const record = salesHistory.find(r => r.id === id)
    await supabase.from('card_sales').delete().eq('id', id)
    setSalesHistory(prev => prev.filter(r => r.id !== id))
    setSalesTotal(prev => Math.max(0, prev - price))
    // Restore card back to collection
    if (record) {
      const { data: restored } = await supabase
        .from('wishlists')
        .insert({
          user_id:   user.id,
          card_id:   record.card_id,
          name:      record.card_name,
          image:     record.card_image,
          owned:     true,
          edition:   'unspecified',
          language:  'english',
        })
        .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, price_source, slot_index, binder_id, edition, is_chase, is_favorite, quantity, language, tags, condition')
        .single()
      if (restored) {
        setItems(prev => [restored, ...prev])
        onOwnedChanged?.(record.card_id, true)
        onToast('Card restored to Collection ✨')
      }
    }
  }

  async function deleteTradeRecord(id) {
    const record = tradesHistory.find(r => r.id === id)
    await supabase.from('card_trades').delete().eq('id', id)
    setTradesHistory(prev => prev.filter(r => r.id !== id))
    setTradeCount(prev => Math.max(0, prev - 1))
    // Restore card back to collection
    if (record) {
      const { data: restored } = await supabase
        .from('wishlists')
        .insert({
          user_id:   user.id,
          card_id:   record.card_id,
          name:      record.card_name,
          image:     record.card_image,
          owned:     true,
          edition:   'unspecified',
          language:  'english',
        })
        .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, price_source, slot_index, binder_id, edition, is_chase, is_favorite, quantity, language, tags, condition')
        .single()
      if (restored) {
        setItems(prev => [restored, ...prev])
        onOwnedChanged?.(record.card_id, true)
        onToast('Card restored to Collection ✨')
      }
    }
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
      .select('card_id, price_source, holofoil_market, holofoil_mid, holofoil_low, normal_market, normal_mid, normal_low, reverse_holo_market, first_ed_holo_market, first_ed_normal_market, other_market, other_mid, other_low, ebay_market')
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

      // Unlimited: prefer holofoil → normal → reverse holo → other → eBay fallback
      const unlMarket = p.holofoil_market ?? p.normal_market ?? p.reverse_holo_market ?? p.other_market ?? p.ebay_market ?? null
      const unlMid    = p.holofoil_mid    ?? p.normal_mid    ?? p.other_mid    ?? null
      const unlLow    = p.holofoil_low    ?? p.normal_low    ?? p.other_low    ?? null

      let market, mid, low, priceSource
      if (is1st) {
        market = p.first_ed_holo_market ?? p.first_ed_normal_market ?? unlMarket
        mid    = unlMid
        low    = unlLow
      } else {
        market = unlMarket
        mid    = unlMid
        low    = unlLow
      }
      // Track source: if we fell back to ebay_market, record that
      priceSource = (market === p.ebay_market && p.price_source === 'ebay') ? 'ebay' : (p.price_source ?? 'tcgplayer')

      const { error } = await supabase
        .from('wishlists')
        .update({ market_price: market, mid_price: mid, low_price: low, price_source: priceSource })
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
      // When moving to collection, clear the chase flag
      return [{ ...target, owned: newOwned, ...(newOwned ? { is_chase: false } : {}) }, ...rest]
    })
    const updatePayload = newOwned
      ? { owned: newOwned, is_chase: false }
      : { owned: newOwned }
    const { error } = await supabase
      .from('wishlists')
      .update(updatePayload)
      .eq('id', rowId)
    if (error) {
      // Revert: move back to original position is hard, just restore the flag
      setItems(prev => prev.map(i => i.id === rowId ? { ...i, owned: currentOwned, is_chase: i.is_chase } : i))
    } else {
      onOwnedChanged?.(cardId, newOwned)
      onToast(newOwned ? 'Added to Collection! ✨📦' : 'Moved back to Wishlist 💖')
    }
  }

  async function handleDeletePack(logId) {
    const { error } = await supabase.from('pack_logs').delete().eq('id', logId)
    if (error) { onToast('Failed to delete pack log'); return }
    setPackLogs(prev => {
      const next = prev.filter(l => l.id !== logId)
      setPackInvested(next.reduce((s, l) => s + (l.pack_price || 0), 0))
      return next
    })
  }

  async function handleSold(item, price) {
    const salePrice = parseFloat(price)
    if (isNaN(salePrice) || salePrice < 0) { onToast('Please enter a valid sale price'); return }
    setSoldModal(null)
    setSoldPrice('')
    // Insert sale record
    await supabase.from('card_sales').insert({
      user_id:    user.id,
      card_id:    item.card_id,
      card_name:  item.name,
      card_image: item.image,
      sale_price: salePrice,
    })
    // Delete from wishlist
    await supabase.from('wishlists').delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setSalesTotal(prev => prev + salePrice)
    onCardRemoved?.(item.card_id)
    onToast('Card sold! 💰')
  }

  async function handleTraded(item) {
    setTradeModal(null)
    // Insert trade record
    await supabase.from('card_trades').insert({
      user_id:    user.id,
      card_id:    item.card_id,
      card_name:  item.name,
      card_image: item.image,
    })
    // Delete from wishlist
    await supabase.from('wishlists').delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setTradeCount(prev => prev + 1)
    onCardRemoved?.(item.card_id)
    onToast('Card traded! 🤝')
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

    // Image priority: user-provided URL > JP image from DB > English fallback
    let imageUrl = item.image
    if (pendingNewImageUrl.trim()) {
      imageUrl = pendingNewImageUrl.trim()
    } else if (newLanguage === 'japanese') {
      const { data: cardRow } = await supabase
        .from('tcg_cards')
        .select('jp_image_small')
        .eq('id', item.card_id)
        .maybeSingle()
      if (cardRow?.jp_image_small) imageUrl = cardRow.jp_image_small
    }

    const { data, error } = await supabase
      .from('wishlists')
      .insert({
        user_id:      user.id,
        card_id:      item.card_id,
        name:         item.name,
        image:        imageUrl,
        owned:        item.owned,
        edition:      item.edition,
        language:     newLanguage,
        quantity:     1,
        market_price: null,
        mid_price:    null,
        low_price:    null,
      })
      .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, price_source, slot_index, binder_id, edition, is_chase, is_favorite, quantity, language, tags')
      .single()
    if (error) {
      onToast('Failed to add language variant')
      return
    }
    setItems(prev => [data, ...prev])
    setAddingDetailFor(null)
    setPendingNewLanguage('')
    setPendingNewImageUrl('')
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

  // Toggle a specific trade/sale status (clicking the same status again clears it)
  async function markTradeStatus(rowId, status) {
    const item = items.find(i => i.id === rowId)
    const finalVal = item?.category === status ? null : status
    setItems(prev => prev.map(i => i.id === rowId ? { ...i, category: finalVal } : i))
    await supabase.from('wishlists').update({ category: finalVal }).eq('id', rowId)
  }

  // Split one virtual copy of a multi-copy card into its own row and assign it to a binder.
  // Called when the user changes the binder dropdown on an expanded (_isExpanded) tile.
  async function splitCopyToBinder(copyItem, targetBinderId) {
    const sourceId = copyItem._sourceId
    const source   = items.find(i => i.id === sourceId)
    if (!source) return

    const currentQty = source.quantity || 1

    // Only one physical copy — just move the whole row
    if (currentQty <= 1) {
      moveCardToBinder(sourceId, targetBinderId)
      return
    }

    // Compute slot in the target binder for the new row
    let nextSlot = null
    if (targetBinderId) {
      const ownedInTarget = items.filter(i => i.binder_id === targetBinderId && i.owned)
      nextSlot = computeNextBinderSlot(ownedInTarget)
    }

    // Insert a new individual row for the split copy
    const { data: newRow, error } = await supabase
      .from('wishlists')
      .insert({
        user_id:      user.id,
        card_id:      source.card_id,
        name:         source.name,
        image:        source.image,
        owned:        true,
        edition:      source.edition      ?? 'unspecified',
        language:     source.language     ?? 'english',
        quantity:     1,
        binder_id:    targetBinderId      || null,
        slot_index:   nextSlot,
        market_price: source.market_price ?? null,
        mid_price:    source.mid_price    ?? null,
        low_price:    source.low_price    ?? null,
        manual_price: source.manual_price ?? null,
        tags:         source.tags         ?? [],
        condition:    source.condition    ?? null,
        is_favorite:  false,
        is_chase:     false,
      })
      .select('id, card_id, name, image, owned, market_price, mid_price, low_price, manual_price, price_source, slot_index, binder_id, edition, is_chase, is_favorite, quantity, language, tags, condition, category')
      .single()

    if (error) { onToast('Could not split copy 😿'); return }

    const newQty = currentQty - 1
    setItems(prev => [
      ...prev.map(i => i.id === sourceId ? { ...i, quantity: newQty } : i),
      { ...newRow, set_name: source.set_name, card_number: source.card_number },
    ])
    await supabase.from('wishlists').update({ quantity: newQty }).eq('id', sourceId)

    const targetName = binders.find(b => b.id === targetBinderId)?.name ?? 'No binder'
    onToast(`Copy moved to ${targetName} ✅`)
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

  // Search for a trainer by exact username, then follow them
  async function searchTrainerToFollow(username) {
    const trimmed = username.trim()
    if (!trimmed) return
    setFollowStatus('searching')
    setFollowResult(null)

    // Only fetch id and username — no private fields
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', trimmed)
      .maybeSingle()

    if (error || !data) { setFollowStatus('notfound'); return }
    if (data.id === user.id) { setFollowStatus('self'); return }

    // Check if already following
    const alreadyFollowing = followedTrainers.some(t => t.id === data.id)
    if (alreadyFollowing) { setFollowStatus('already'); setFollowResult(data); return }

    setFollowStatus('found')
    setFollowResult(data)
  }

  async function confirmFollow() {
    if (!followResult) return
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: followResult.id })
    if (error) { onToast('Could not follow — try again 😿'); return }

    // Refresh followed trainers list
    const { data: profile } = await supabase
      .from('profiles').select('id, username').eq('id', followResult.id).maybeSingle()
    if (profile) {
      setFollowedTrainers(prev => [
        { id: profile.id, username: profile.username, cards: [], cardCount: 0 },
        ...prev,
      ])
    }
    onToast(`Now following @${followResult.username} ✨`)
    setFollowInput('')
    setFollowStatus(null)
    setFollowResult(null)
  }

  async function removeCard(item) {
    const otherEditionsExist = items.some(i => i.id !== item.id && i.card_id === item.card_id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('wishlists').delete().eq('id', item.id)
    if (!otherEditionsExist) onCardRemoved?.(item.card_id)
    onToast('Removed ✕')
  }

  // Remove one physical copy from a multi-copy row.
  // Decrements quantity by 1; removes the row when it reaches 0.
  async function removeOneCopy(item) {
    const qty = item.quantity || 1
    if (qty <= 1) {
      await removeCard(item)
    } else {
      const next = qty - 1
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i))
      await supabase.from('wishlists').update({ quantity: next }).eq('id', item.id)
      onToast(`Removed 1 copy · ${next} remaining`)
    }
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
    const realItemIds = new Set(items.map(i => i.id))
    const realSwaps    = swaps.filter(s => realItemIds.has(s.id))
    const virtualSwaps = swaps.filter(s => !realItemIds.has(s.id))

    // Only call setItems when real rows actually changed — avoids a spurious
    // recompute of binderDisplayItems that would reset virtual copy positions.
    if (realSwaps.length) {
      setItems(prev => prev.map(item => {
        const swap = realSwaps.find(s => s.id === item.id)
        return swap ? { ...item, slot_index: swap.slot_index } : item
      }))
    }

    // Track virtual copy positions in a separate state map so they survive
    // re-renders triggered by other state changes.
    if (virtualSwaps.length) {
      setVirtualSlots(prev => {
        const next = { ...prev }
        for (const s of virtualSwaps) next[s.id] = s.slot_index
        return next
      })
    }
  }

  // Called by BinderView when the user clicks the ✕ on an empty page.
  // Shifts slot_index of all cards on pages after the deleted page down by -slotsPerPage.
  async function handleDeletePage(pageNumber) {
    const SLOTS_PER_PAGE = binderSlotsPerPage.current
    const threshold      = pageNumber * SLOTS_PER_PAGE   // first slot of the page AFTER deleted one
    const binderId       = selectedBinder?.id
    if (!binderId) return

    const affected = items.filter(
      i => i.binder_id === binderId && i.owned && (i.slot_index ?? 0) >= threshold
    )

    // Optimistic update for real rows
    setItems(prev => prev.map(i => {
      const hit = affected.find(a => a.id === i.id)
      return hit ? { ...i, slot_index: (hit.slot_index ?? 0) - SLOTS_PER_PAGE } : i
    }))

    // Shift any virtual copy positions that fall at or past the threshold
    setVirtualSlots(prev => {
      const next = { ...prev }
      for (const [id, slot] of Object.entries(next)) {
        if (slot >= threshold) next[id] = slot - SLOTS_PER_PAGE
      }
      return next
    })

    // Persist
    await Promise.all(affected.map(i =>
      supabase.from('wishlists')
        .update({ slot_index: (i.slot_index ?? 0) - SLOTS_PER_PAGE })
        .eq('id', i.id)
    ))
    onToast(`Empty page ${pageNumber} removed 🗑`)
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
    if (!affected.length) {
      onToast('No cards to shift — all cards are before this point')
      return
    }

    // Optimistic update for real rows
    setItems(prev => prev.map(i => {
      const hit = affected.find(a => a.id === i.id)
      return hit ? { ...i, slot_index: (hit.slot_index ?? 0) + SLOTS_PER_PAGE } : i
    }))

    // Shift any virtual copy positions at or past the threshold
    setVirtualSlots(prev => {
      const next = { ...prev }
      for (const [id, slot] of Object.entries(next)) {
        if (slot >= threshold) next[id] = slot + SLOTS_PER_PAGE
      }
      return next
    })

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

    // Optimistic update for real rows
    setItems(prev => prev.map(i => {
      const u = updates.find(u => u.id === i.id)
      return u ? { ...i, slot_index: u.slot_index } : i
    }))

    // Swap virtual copy positions between the two pages
    setVirtualSlots(prev => {
      const next = { ...prev }
      for (const [id, slot] of Object.entries(next)) {
        if (slot >= slotA_start && slot <= slotA_end) {
          next[id] = slot + delta   // page A → page B position
        } else if (slot >= slotB_start && slot <= slotB_end) {
          next[id] = slot - delta   // page B → page A position
        }
      }
      return next
    })

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

  // Quick-add: assign a collection card (not yet in this binder) to the clicked empty slot
  async function handleQuickAddCard(item) {
    if (!selectedBinder || quickAddSlot === null) return
    const { error } = await supabase
      .from('wishlists')
      .update({ binder_id: selectedBinder.id, slot_index: quickAddSlot })
      .eq('id', item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, binder_id: selectedBinder.id, slot_index: quickAddSlot }
        : i
      ))
      onToast(`${item.name} added to binder ✅`)
    }
    setQuickAddSlot(null)
    setQuickAddSearch('')
  }

  // Handles onTransfer from BinderView — routes virtual copies to removeOneCopy
  function handleBinderTransfer(itemId, targetBinderId) {
    const item = binderDisplayItems.find(i => i.id === itemId)
    if (item?._isExpanded) {
      // Virtual copy — decrement quantity (effectively removes one copy from the binder)
      removeOneCopy({ ...item, id: item._sourceId })
    } else {
      moveCardToBinder(itemId, targetBinderId)
    }
  }

  // Handles onRemoveFromCollection from BinderView for virtual copies
  function handleBinderRemoveFromCollection(item) {
    if (item._isExpanded) {
      removeOneCopy({ ...item, id: item._sourceId })
    } else {
      removeCard(item)
    }
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
      key={item._key ?? item.id}
      layout
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`rounded-2xl overflow-hidden shadow-md relative ${item.owned ? 'tile-owned' : 'tile-wishlist'}`}
    >
      {/* Star / favourite — top-left (opposite the ✕) */}
      {item.owned && (() => {
        const favCount = items.filter(i => i.is_favorite).length
        const favAtMax = !item.is_favorite && favCount >= 3
        return (
          <>
            <button
              onClick={() => !favAtMax && toggleFavorite(item.id, item.is_favorite)}
              disabled={favAtMax}
              className={`absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full flex items-center
                         justify-center text-xs shadow-sm transition-all leading-none
                         ${item.is_favorite
                           ? 'bg-indigo-400 text-white'
                           : favAtMax
                             ? 'bg-white/70 text-gray-200 cursor-not-allowed'
                             : 'bg-white/70 text-gray-300 hover:bg-indigo-100 hover:text-indigo-400'
                         }`}
              title={item.is_favorite ? 'Remove from favourites' : favAtMax ? 'Max 3 favourites' : 'Add to favourites'}
            >
              {item.is_favorite ? '★' : '☆'}
            </button>
            {/* Single trade/sale button — click to open dropdown, click active status to clear */}
            <div className="absolute top-9 left-1.5 z-10">
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (item.category) {
                    markTradeStatus(item.id, item.category) // clears it
                  } else {
                    setTradeDropdownId(prev => prev === item.id ? null : item.id)
                  }
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-sm transition-all leading-none
                  ${item.category === 'for_sale'
                    ? 'bg-emerald-400 text-white'
                    : item.category === 'for_trade'
                    ? 'bg-blue-400 text-white'
                    : 'bg-white/70 text-gray-300 hover:bg-amber-50 hover:text-amber-500'}`}
                title={item.category === 'for_sale' ? 'For Sale — click to remove' : item.category === 'for_trade' ? 'For Trade — click to remove' : 'Mark as For Sale or Trade'}
              >
                {item.category === 'for_sale' ? '💰' : item.category === 'for_trade' ? '🔄' : '↕️'}
              </button>
              {tradeDropdownId === item.id && !item.category && (
                <div className="absolute left-0 top-7 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[110px]"
                  onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { markTradeStatus(item.id, 'for_sale'); setTradeDropdownId(null) }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                  >💰 For Sale</button>
                  <button
                    onClick={() => { markTradeStatus(item.id, 'for_trade'); setTradeDropdownId(null) }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                  >🔄 For Trade</button>
                </div>
              )}
            </div>
          </>
        )
      })()}

      <button
        onClick={() => item._isExpanded ? removeOneCopy(item) : removeCard(item)}
        className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/70
                   text-gray-400 hover:text-red-400 hover:bg-white text-xs leading-none
                   flex items-center justify-center shadow-sm transition-colors"
        title={item._isExpanded ? `Remove copy ${item._copyIndex} of ${item._totalCopies}` : 'Remove this edition'}
      >✕</button>

      <div className="relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-full cursor-pointer"
          loading="lazy"
          onClick={() => setSelectedItem(item)}
          onError={e => { e.currentTarget.src = CARD_BACK }}
        />
        {item.owned && (
          item._isExpanded
            ? <span className="absolute bottom-1.5 right-1.5 text-[11px] font-bold bg-emerald-500 text-white
                               px-1.5 py-0.5 rounded-full shadow leading-none">
                {item._copyIndex}/{item._totalCopies}
              </span>
            : (item.quantity || 1) > 1
              ? <span className="absolute bottom-1.5 right-1.5 text-[11px] font-bold bg-emerald-500 text-white
                                 px-1.5 py-0.5 rounded-full shadow leading-none">
                  ×{item.quantity}
                </span>
              : null
        )}
      </div>

      <div className="p-2 text-center">
        <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
        {(item.set_name || item.card_number) && (
          <p className="text-[10px] text-gray-400 truncate mb-0.5">
            {[item.set_name, item.card_number ? `#${item.card_number}` : null].filter(Boolean).join(' · ')}
          </p>
        )}

        {(() => {
          const { value: p, label, source } = getPriceInfo(item)
          const isEbay    = source === 'ebay'
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
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${label === 'Manual'
                      ? 'text-violet-600 bg-violet-100'
                      : isEbay
                        ? 'text-amber-700 bg-amber-100'
                        : 'text-pink-600 bg-pink-100'
                    }`}
                  title={isEbay ? 'avg. of last 10 eBay sales' : undefined}
                >
                  ${p.toFixed(2)}{isEbay ? ' ⊕' : label ? ` (${label})` : ''}
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

        {(item.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mb-1">
            {item.tags.map(t => (
              <span key={t}
                className="inline-flex items-center gap-0.5 text-[9px] font-semibold
                           px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-500"
              >
                {t}
                <button
                  onClick={e => { e.stopPropagation(); saveTags(item.id, (item.tags ?? []).filter(x => x !== t)) }}
                  className="text-rose-300 hover:text-rose-500 leading-none ml-0.5"
                  aria-label={`Remove tag ${t}`}
                >✕</button>
              </span>
            ))}
          </div>
        )}

        {!item.owned && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => toggleOwned(item.id, item.card_id, item.owned)}
            className="w-full text-xs font-semibold py-1.5 rounded-xl transition-all mt-1
                       bg-white/70 text-gray-400 hover:bg-pink-50 hover:text-pink-500 border border-gray-200
                       flex items-center justify-center gap-1.5"
          >
            <span
              className={`theme-ball ${document.body.dataset.theme === 'dark' ? 'luxury-ball' : 'love-ball'}`}
              style={{ width: '0.9em', height: '0.9em', flexShrink: 0, display: 'inline-block' }}
            >
              <span className="theme-ball__top" />
              <span className="theme-ball__band" />
              <span className="theme-ball__button" />
              <span className="theme-ball__mark">{document.body.dataset.theme === 'dark' ? 'L' : '♥'}</span>
            </span>
            I own this
          </motion.button>
        )}

        {item.owned && !item._isExpanded && (
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
        {/* Spacer for expanded duplicate tiles — keeps binder dropdown + tag bar aligned */}
        {item.owned && item._isExpanded && <div className="mt-1.5 h-6" />}

        {/* Chase — wishlist cards can set/unset; owned cards that are still chased can unset */}
        {(!item.owned || item.is_chase) && (() => {
          const chaseCount  = items.filter(i => i.is_chase).length
          const chaseAtMax  = !item.is_chase && !item.owned && chaseCount >= 3
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
              title={item.is_chase ? 'Remove chase mark' : chaseAtMax ? 'Max 3 chase cards reached' : 'Mark as a chase card (max 3)'}
            >
              {item.is_chase ? '🎯 Chasing!' : chaseAtMax ? '🎯 Full (3/3)' : '🎯 Chase'}
            </motion.button>
          )
        })()}


        {/* Language + Edition info — shown as compact read-only badges */}
        {(() => {
          const lang    = item.language ?? 'english'
          const flag    = lang !== 'english' ? (LANGUAGE_FLAG[lang] ?? '🌐') : null
          const edition = editionLabel(item.edition)
          return (flag || edition) ? (
            <div className="flex flex-wrap gap-1 justify-center mt-1.5">
              {flag && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold
                                 bg-blue-50 text-blue-500 border border-blue-200
                                 px-1.5 py-0.5 rounded-full">
                  {flag} {LANGUAGE_OPTIONS.find(l => l.value === lang)?.label}
                </span>
              )}
              {edition && (
                <span className="text-[9px] font-semibold text-pink-500 bg-pink-50 border border-pink-200
                                 px-1.5 py-0.5 rounded-full">
                  {edition}
                </span>
              )}
            </div>
          ) : null
        })()}

        {item.owned && binders.length > 0 ? (
          <select
            value={item.binder_id ?? ''}
            onChange={e => item._isExpanded && item._copyIndex > 0
              ? splitCopyToBinder(item, e.target.value)
              : moveCardToBinder(item._sourceId ?? item.id, e.target.value)
            }
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

        {/* Inline tag input with autocomplete */}
        {(() => {
          const currentInput = tileTagInputs[item.id] ?? ''
          const existingTags = item.tags ?? []
          const suggestions  = currentInput.trim().length > 0
            ? allUserTags.filter(t =>
                t.toLowerCase().includes(currentInput.trim().toLowerCase()) &&
                !existingTags.includes(t)
              )
            : []
          const addTag = (t) => {
            const trimmed = t.trim()
            if (trimmed && !existingTags.includes(trimmed)) {
              saveTags(item.id, [...existingTags, trimmed])
            }
            setTileTagInputs(prev => ({ ...prev, [item.id]: '' }))
          }
          return (
            <div className="mt-2 relative">
              <input
                type="text"
                value={currentInput}
                onChange={e => setTileTagInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { addTag(currentInput); e.preventDefault() }
                  if (e.key === 'Escape') setTileTagInputs(prev => ({ ...prev, [item.id]: '' }))
                }}
                placeholder="+ Add tag…"
                className="w-full text-xs border border-gray-200 rounded-xl px-2 py-1.5
                           bg-white/80 text-gray-500 placeholder-gray-300
                           focus:outline-none focus:ring-1 focus:ring-rose-300"
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-0.5 z-30 bg-white border border-gray-200
                                rounded-xl shadow-lg overflow-hidden max-h-32 overflow-y-auto">
                  {suggestions.slice(0, 6).map(s => (
                    <button
                      key={s}
                      onMouseDown={e => { e.preventDefault(); addTag(s) }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-gray-600
                                 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </motion.div>
  )

  return (
    <>
      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-4 space-y-2">

        {/* Row 0 (mobile only): username (left) | Socials menu + settings (right) */}
        <div className="flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-2 min-w-0">
            {profile?.username && (
              <span className="text-xs font-bold text-pink-500 truncate max-w-[140px]">
                @{profile.username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Socials menu button */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={e => { e.stopPropagation(); setShowSocialsMenu(p => !p) }}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5
                           border rounded-full shadow-sm transition-colors
                           ${showSocialsMenu || ['trainers','followers','socialfeed'].includes(activeTab)
                             ? 'bg-pink-400 text-white border-pink-400'
                             : 'bg-white/60 border-gray-200 text-gray-500 hover:bg-white/80'}`}
              >
                👥 Socials
              </motion.button>
              {showSocialsMenu && (
                <div
                  className="absolute right-0 top-9 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[175px]"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setActiveTab('socialfeed'); setShowSocialsMenu(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors
                      ${activeTab === 'socialfeed' ? 'text-pink-500 bg-pink-50' : 'text-gray-600 hover:bg-gray-50'}`}
                  >📰 Social Feed</button>
                  <button
                    onClick={() => { setActiveTab('trainers'); setShowSocialsMenu(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors
                      ${activeTab === 'trainers' ? 'text-pink-500 bg-pink-50' : 'text-gray-600 hover:bg-gray-50'}`}
                  >👥 Following{followedTrainers.length > 0 && <span className="ml-auto text-xs text-gray-400">{followedTrainers.length}</span>}</button>
                  <button
                    onClick={() => { setActiveTab('followers'); setShowSocialsMenu(false) }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors
                      ${activeTab === 'followers' ? 'text-pink-500 bg-pink-50' : 'text-gray-600 hover:bg-gray-50'}`}
                  >🫂 Followers{followers.length > 0 && <span className="ml-auto text-xs text-gray-400">{followers.length}</span>}</button>
                  {isPublic && (
                    <>
                      <div className="border-t border-gray-100" />
                      <button
                        onClick={() => { handleShare(); setShowSocialsMenu(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                      >↗ Share Profile</button>
                    </>
                  )}
                </div>
              )}
            </div>
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
        </div>

        {/* Row 0b (mobile only): Browse All Cards — full width */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onGoExplore}
          className="w-full sm:hidden flex items-center justify-center gap-1.5
                     text-sm font-bold px-4 py-2.5
                     bg-gradient-to-r from-pink-400 to-violet-400 text-white
                     rounded-full shadow-md transition-all"
        >
          ▤ Browse All Cards
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onOpenScanner}
          className="w-full sm:hidden flex items-center justify-center gap-1.5
                     text-sm font-bold px-4 py-2.5
                     bg-white/70 text-violet-600 border border-violet-200
                     rounded-full shadow-sm transition-all"
        >
          Scan Cards
        </motion.button>

        {/* Row 1: My Cards + Virtual Binder */}
        <div className="flex gap-2 sm:hidden">
          {[
            { id: 'cards',  label: 'My Cards 📦',      isActive: activeTab === 'collection' || activeTab === 'wishlist',
              action: () => { if (activeTab !== 'collection' && activeTab !== 'wishlist') setActiveTab('collection'); setCollectionPage(1); setWishlistPage(1) } },
            { id: 'binder', label: 'Virtual Binder 📒', isActive: activeTab === 'binder',
              action: () => { setActiveTab('binder'); setCollectionPage(1); setWishlistPage(1) } },
          ].map(tab => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={tab.action}
              className={`flex-1 px-3 py-2 rounded-full text-sm font-semibold transition-all border shadow-sm
                ${tab.isActive
                  ? 'bg-pink-400 text-white border-pink-400 shadow-pink-200'
                  : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Row 2: Lists — full width */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
          onClick={() => { setActiveTab('lists'); setCollectionPage(1); setWishlistPage(1) }}
          className={`w-full sm:hidden px-5 py-2 rounded-full text-sm font-semibold transition-all border shadow-sm
            ${activeTab === 'lists'
              ? 'bg-pink-400 text-white border-pink-400 shadow-pink-200'
              : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
            }`}
        >
          Lists 📋
        </motion.button>

        {/* Desktop: Browse All Cards — own row above the tab pills */}
        <div className="hidden sm:flex justify-center">
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={onGoExplore}
            className="flex items-center gap-2 text-sm font-bold px-5 py-2
                       bg-gradient-to-r from-pink-400 to-violet-400 text-white
                       rounded-full shadow-md transition-all"
          >
            ▤ Browse All Cards
          </motion.button>
        </div>

        {/* Desktop: tab pills + share/settings */}
        <div className="hidden sm:flex sm:flex-wrap sm:justify-center sm:items-center gap-2">
          {[
            { id: 'cards',     label: 'My Cards 📦',      isActive: activeTab === 'collection' || activeTab === 'wishlist',
              action: () => { if (activeTab !== 'collection' && activeTab !== 'wishlist') setActiveTab('collection'); setCollectionPage(1); setWishlistPage(1) } },
            { id: 'binder',    label: 'Virtual Binder 📒', isActive: activeTab === 'binder',
              action: () => { setActiveTab('binder'); setCollectionPage(1); setWishlistPage(1) } },
            { id: 'lists',     label: 'Lists 📋',           isActive: activeTab === 'lists',
              action: () => { setActiveTab('lists'); setCollectionPage(1); setWishlistPage(1) } },
            { id: 'trainers',  label: `Following 👥${followedTrainers.length ? ` · ${followedTrainers.length}` : ''}`,
              isActive: activeTab === 'trainers', action: () => { setActiveTab('trainers'); setCollectionPage(1); setWishlistPage(1) } },
            { id: 'followers', label: `Followers 🫂${followers.length ? ` · ${followers.length}` : ''}`,
              isActive: activeTab === 'followers', action: () => { setActiveTab('followers'); setCollectionPage(1); setWishlistPage(1) } },
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
      </div>

      {/* ── Shared stats + HighRollers (collection & wishlist tabs only) ── */}
      {(activeTab === 'collection' || activeTab === 'wishlist') && items.length > 0 && <>
        <div className="grid grid-cols-3 gap-3 px-4 pb-4">
          <StatCard icon="📦" label="Collection Value"    value={collectionValue} color="mint"  prefix="$" decimals={2} />
          <StatCard icon="✨" label="Wishlist Value"       value={wishlistValue}   color="lilac" prefix="$" decimals={2} />
          <StatCard icon="🎴" label="Total Invested"       value={packInvested}    color="pink"  prefix="$" decimals={2} onClick={() => setPackLogOpen(true)} />
          <StatCard icon="✅" label="Progress"             value={totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0} color="lilac" suffix="%" />
          <StatCard icon="💰" label="Total Sales"          value={salesTotal}      color="mint"  prefix="$" decimals={2} onClick={openSalesHistory} />
          <StatCard icon="🤝" label="Cards Traded"         value={tradeCount}      color="pink"  onClick={openTradesHistory} />
        </div>
        <ShowcasePanels ownedItems={ownedItemsList} allItems={items} onCardClick={setSelectedItem} />
      </>}

      {/* ── Collection / Wishlist sub-nav ──────────────────────────── */}
      {(activeTab === 'collection' || activeTab === 'wishlist' || activeTab === 'fortrade') && (
        <div className="px-4 pt-1 pb-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setActiveTab('collection'); setCollectionPage(1) }}
              className={`flex min-w-0 items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] sm:text-sm font-semibold
                         border transition-all shadow-sm
                         ${activeTab === 'collection'
                           ? 'bg-emerald-400 text-white border-emerald-400'
                           : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                         }`}
            >
              <span className="hidden sm:inline">📦 Collection</span><span className="sm:hidden">Cards</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none
                ${activeTab === 'collection' ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
                {totalCopies !== ownedCount ? totalCopies : ownedCount}
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setActiveTab('wishlist'); setWishlistPage(1) }}
              className={`flex min-w-0 items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] sm:text-sm font-semibold
                         border transition-all shadow-sm
                         ${activeTab === 'wishlist'
                           ? 'bg-violet-400 text-white border-violet-400'
                           : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                         }`}
            >
              <span className="hidden sm:inline">✨ Wishlist</span><span className="sm:hidden">Wishlist</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none
                ${activeTab === 'wishlist' ? 'bg-white/30 text-white' : 'bg-violet-100 text-violet-600'}`}>
                {wishlistCount}
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setActiveTab('fortrade')}
              className={`flex min-w-0 items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] sm:text-sm font-semibold
                         border transition-all shadow-sm
                         ${activeTab === 'fortrade'
                           ? 'bg-amber-400 text-white border-amber-400'
                           : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                         }`}
            >
              <span className="hidden sm:inline">💰 For Trade/Sale</span><span className="sm:hidden">Trade/Sale</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none
                ${activeTab === 'fortrade' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-600'}`}>
                {items.filter(i => i.category === 'for_sale' || i.category === 'for_trade').length}
              </span>
            </motion.button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              value={cardSearch}
              onChange={e => { setCardSearch(e.target.value); setCollectionPage(1); setWishlistPage(1) }}
              placeholder={`Search ${activeTab === 'collection' ? 'collection' : activeTab === 'wishlist' ? 'wishlist' : 'for trade/sale'}…`}
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

          {/* Sort toggle + Dupes toggle */}
          <div className="flex items-center justify-between gap-2">
            {/* Left — sort pills */}
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

            {/* Right — dupes toggle (collection tab only) */}
            {activeTab === 'collection' && (
              <button
                onClick={() => { setShowDupes(v => !v); setCollectionPage(1) }}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors select-none"
                title={showDupes ? 'Collapse duplicates into one tile' : 'Expand duplicates into separate tiles'}
              >
                <span>Dupes</span>
                <span
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full
                               transition-colors duration-200
                               ${showDupes ? 'bg-emerald-400' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm
                                 transform transition-transform duration-200
                                 ${showDupes ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </span>
              </button>
            )}
          </div>

          {/* Tag filter — collapsed into a menu button */}
          {allTags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTagMenu(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                  ${tagFilter
                    ? 'bg-rose-400 text-white border-rose-400'
                    : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
                  }`}
              >
                🏷️ {tagFilter ? tagFilter : 'Tags'}
                <span className="opacity-60">{showTagMenu ? '▲' : '▼'}</span>
              </button>
              {showTagMenu && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200
                                rounded-2xl shadow-lg p-2 flex flex-wrap gap-1.5 min-w-[160px] max-w-[280px]">
                  <button
                    onClick={() => { setTagFilter(null); setCollectionPage(1); setWishlistPage(1); setShowTagMenu(false) }}
                    className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all
                      ${!tagFilter ? 'bg-rose-400 text-white border-rose-400' : 'bg-white text-gray-500 border-gray-200 hover:bg-rose-50 hover:text-rose-500'}`}
                  >
                    All
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => { setTagFilter(tagFilter === tag ? null : tag); setCollectionPage(1); setWishlistPage(1); setShowTagMenu(false) }}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all
                        ${tagFilter === tag ? 'bg-rose-400 text-white border-rose-400' : 'bg-white text-gray-500 border-gray-200 hover:bg-rose-50 hover:text-rose-500'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Binder tab ─────────────────────────────────────────────── */}
      {activeTab === 'binder' && (
        <>
          {/* Bookshelf row */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {binders.map(b => {
                const isActive = selectedBinder?.id === b.id
                const col      = b.color ?? '#a78bfa'
                return (
                  <motion.div
                    key={b.id}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className={`flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-1.5
                               font-semibold text-sm rounded-full border-2 transition-all select-none`}
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
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm cursor-pointer"
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
                        className="w-20 bg-white/30 text-white placeholder-white/60 text-xs font-semibold
                                   rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-white/60"
                      />
                    ) : (
                      <button
                        onClick={() => setSelectedBinder(b)}
                        className="focus:outline-none truncate max-w-[80px] text-sm"
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

          {/* Binder value strip */}
          {selectedBinder && (
            <div className="flex items-center justify-between px-4 py-2.5 mb-2
                            bg-pink-50/60 border border-pink-100 rounded-2xl
                            text-sm font-semibold text-pink-500">
              <span className="truncate max-w-[60%]">{selectedBinder.name}</span>
              <span className="text-pink-400 font-bold tabular-nums">
                {binderValue > 0
                  ? `$${binderValue.toFixed(2)}`
                  : <span className="font-normal text-pink-300 text-xs">No prices yet</span>
                }
              </span>
            </div>
          )}

          {/* Binder view for selected binder */}
          {selectedBinder ? (
            <BinderView
              key={selectedBinder.id}
              items={binderDisplayItems}
              user={user}
              initialTheme={{
                coverColor: selectedBinder.cover_color ?? selectedBinder.color ?? '#a78bfa',
                pageStyle:  selectedBinder.page_style  ?? 'white',
              }}
              onThemeChange={theme => updateBinderTheme(selectedBinder.id, theme)}
              binders={binders}
              onTransfer={handleBinderTransfer}
              currentBinderId={selectedBinder.id}
              onCardClick={setSelectedItem}
              onSlotsSwapped={handleSlotsSwapped}
              onRemoveFromCollection={handleBinderRemoveFromCollection}
              onInsertPage={handleInsertPage}
              onMovePage={handleMovePage}
              onDeletePage={handleDeletePage}
              onSlotsPerPageChange={spp => { binderSlotsPerPage.current = spp }}
              onEmptySlotClick={handleEmptySlotClick}
            />
          ) : (
            <p className="text-center text-pink-300 font-semibold mt-16 text-sm">
              Create a binder above to get started 📒
            </p>
          )}
        </>
      )}

      {/* ── Lists tab ─────────────────────────────────────────────── */}
      {activeTab === 'lists' && (
        <div className="max-w-2xl mx-auto">
          <CardLists user={user} onToast={onToast} />
        </div>
      )}

      {/* ── Followed trainers ──────────────────────────────────────── */}
      {activeTab === 'trainers' && (
        <div className="max-w-2xl mx-auto px-4 pb-16">

          {/* Follow by username + search — always visible */}
          <div className="mb-4 space-y-3">
            {/* Follow by username */}
            <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide">Follow a trainer</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={followInput}
                  onChange={e => { setFollowInput(e.target.value); setFollowStatus(null); setFollowResult(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchTrainerToFollow(followInput)}
                  placeholder="Enter exact username…"
                  className="flex-1 text-sm border border-pink-200 rounded-full px-4 py-2
                             bg-white/80 placeholder-pink-300 text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => searchTrainerToFollow(followInput)}
                  disabled={followStatus === 'searching'}
                  className="px-4 py-2 rounded-full bg-pink-400 hover:bg-pink-500 text-white
                             text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {followStatus === 'searching' ? '…' : 'Search'}
                </motion.button>
              </div>
              {followStatus === 'notfound' && (
                <p className="text-xs text-gray-400">No trainer found with that username.</p>
              )}
              {followStatus === 'self' && (
                <p className="text-xs text-gray-400">That's you! You can't follow yourself.</p>
              )}
              {followStatus === 'already' && followResult && (
                <p className="text-xs text-pink-400">You already follow @{followResult.username}.</p>
              )}
              {followStatus === 'found' && followResult && (
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-pink-100">
                  <span className="text-sm font-semibold text-gray-700">@{followResult.username}</span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={confirmFollow}
                    className="px-3 py-1 rounded-full bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold transition-colors"
                  >
                    Follow ✨
                  </motion.button>
                </div>
              )}
            </div>

            {/* Search through following list */}
            {followedTrainers.length > 0 && (
              <input
                type="text"
                value={trainerSearch}
                onChange={e => setTrainerSearch(e.target.value)}
                placeholder="Search following…"
                className="w-full text-sm border border-gray-200 rounded-full px-4 py-2
                           bg-white/80 placeholder-gray-300 text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
            )}
          </div>

          {followedTrainers.length === 0 ? (
            <div className="flex flex-col items-center text-center mt-8 px-4 gap-4">
              <p className="text-5xl">🔍</p>
              <div>
                <p className="text-pink-400 font-bold text-lg mb-1">
                  Find your friends!
                </p>
                <p className="text-sm text-gray-400 max-w-xs">
                  Search by username above, or browse cards and visit a trainer's public page to follow them.
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
              {followedTrainers
                .filter(t => !trainerSearch.trim() || t.username?.toLowerCase().includes(trainerSearch.trim().toLowerCase()))
                .map(trainer => (
                  <TrainerCard key={trainer.id} trainer={trainer} onCardClick={setSelectedFollowedCard} />
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

      {/* ── Social Feed tab ────────────────────────────────────────── */}
      {activeTab === 'socialfeed' && (
        <div className="max-w-2xl mx-auto px-4 pb-16 pt-2">
          {feedLoading ? (
            <div className="flex justify-center mt-16">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-pink-300 border-t-pink-500" />
            </div>
          ) : feedItems.length === 0 ? (
            <div className="flex flex-col items-center text-center mt-16 gap-3">
              <p className="text-5xl">📰</p>
              <p className="font-bold text-lg text-pink-400">Nothing in your feed yet</p>
              <p className="text-sm text-gray-400">
                Follow other trainers to see their collection activity here.
              </p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveTab('trainers')}
                className="mt-2 px-5 py-2 rounded-full text-sm font-semibold
                           bg-pink-400 text-white shadow-sm hover:bg-pink-500 transition-colors"
              >
                Find trainers to follow
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {feedItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-2xl border p-3 shadow-sm"
                  style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                >
                  {item.type === 'card' ? (
                    <>
                      {item.cardImage ? (
                        <img
                          src={item.cardImage}
                          alt={item.cardName}
                          className="h-14 w-auto rounded-lg flex-shrink-0 shadow-sm"
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="h-14 w-10 rounded-lg flex-shrink-0 bg-pink-100 flex items-center justify-center text-pink-300 text-xl">🃏</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>
                          <span className="text-pink-500">@{item.username}</span>
                          {' '}
                          <span className="font-normal text-gray-500">{item.action}</span>
                        </p>
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)', opacity: 0.8 }}>
                          {item.cardName}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(item.time)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-14 w-10 rounded-lg flex-shrink-0 bg-violet-100 flex items-center justify-center text-xl">
                        {item.hasHit ? '✨' : '🎴'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>
                          <span className="text-pink-500">@{item.username}</span>
                          {' '}
                          <span className="font-normal text-gray-500">opened a pack</span>
                        </p>
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)', opacity: 0.8 }}>
                          {item.packName}{item.hasHit ? ' — got a hit! ✨' : ''}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(item.time)}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
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
        if (collectionDisplayItems.length === 0) return (
          <p className="text-center text-gray-300 font-semibold mt-8 mb-4">
            No cards match "{cardSearch}" ✨
          </p>
        )
        const totalColPages   = Math.ceil(collectionDisplayItems.length / ITEMS_PER_PAGE)
        const collectionSlice = collectionDisplayItems.slice(
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

      {/* ── For Trade / Sale ───────────────────────────────────────── */}
      {activeTab === 'fortrade' && (() => {
        const s = cardSearch.toLowerCase()
        const forTradeItems = items
          .filter(i => i.category === 'for_sale' || i.category === 'for_trade')
          .filter(i => !s || (i.name ?? '').toLowerCase().includes(s) || (i.set_name ?? '').toLowerCase().includes(s))
        return (
          <div className="max-w-6xl mx-auto pb-16">
            {items.filter(i => i.category === 'for_sale' || i.category === 'for_trade').length === 0 ? (
              <div className="text-center mt-16 px-4">
                <p className="text-4xl mb-4">💰</p>
                <p className="text-amber-400 font-semibold text-lg mb-2">No cards listed yet!</p>
                <p className="text-gray-400 text-sm">
                  In your collection, tap the <strong>↕️</strong> button on any card to mark it as For Sale or For Trade.
                </p>
              </div>
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
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4"
                  initial="hidden" animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                >
                  <AnimatePresence>{forTradeItems.map(renderTile)}</AnimatePresence>
                </motion.div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── Quick-add to binder slot ────────────────────────────────── */}
      <AnimatePresence>
        {quickAddSlot !== null && (() => {
          // Only offer cards that are not already assigned to any binder
          const candidates = items.filter(i => i.owned && !i.binder_id)
          const s = quickAddSearch.toLowerCase()
          const filtered = s
            ? candidates.filter(i =>
                (i.name ?? '').toLowerCase().includes(s) ||
                (i.set_name ?? '').toLowerCase().includes(s)
              )
            : candidates
          return (
            <motion.div
              key="quick-add-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={e => { if (e.target === e.currentTarget) { setQuickAddSlot(null); setQuickAddSearch('') } }}
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'var(--app-bg, #fff)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
              >
                <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-gray-700 text-base">Add to slot #{quickAddSlot + 1}</h3>
                  <button
                    onClick={() => { setQuickAddSlot(null); setQuickAddSearch('') }}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 text-sm flex items-center justify-center"
                  >✕</button>
                </div>
                <div className="px-4 pb-2">
                  <input
                    autoFocus
                    type="text"
                    value={quickAddSearch}
                    onChange={e => setQuickAddSearch(e.target.value)}
                    placeholder="Search your collection…"
                    className="w-full px-3 py-2 text-sm rounded-full border border-gray-200 bg-white/80
                               focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder-gray-300 text-gray-600"
                  />
                </div>
                <div className="overflow-y-auto flex-1 px-4 pb-4">
                  {filtered.length === 0 ? (
                    <p className="text-center text-gray-300 text-sm py-8">
                      {candidates.length === 0 ? 'All collection cards are already in a binder. Use the binder dropdown on a tile to move a card here.' : 'No matches found.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {filtered.slice(0, 60).map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleQuickAddCard(item)}
                          className="rounded-xl overflow-hidden border-2 border-transparent hover:border-violet-400 transition-all text-left"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full"
                            onError={e => { e.currentTarget.src = CARD_BACK }}
                          />
                          <p className="text-[9px] font-semibold text-gray-600 truncate px-1 py-0.5 text-center">{item.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

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
            onSaveTags={saveTags}
            user={user}
            onToast={onToast}
            onEditionChange={(id, val) => updateEdition(id, val)}
            onConditionChange={(id, val) => saveCondition(id, val)}
            onToggleFavorite={(id, current) => {
              toggleFavorite(id, current)
              setSelectedItem(prev => prev ? { ...prev, is_favorite: !current } : prev)
            }}
            favAtMax={!selectedItem?.is_favorite && items.filter(i => i.is_favorite).length >= 3}
            onMoveToWishlist={(rowId) => {
              const target = items.find(i => i.id === rowId)
              if (target) {
                setItems(prev => prev.map(i => i.id === rowId ? { ...i, owned: false } : i))
                onOwnedChanged?.(target.card_id, false)
              }
            }}
            onSold={(item, price) => {
              setItems(prev => prev.filter(i => i.id !== item.id))
              setSalesTotal(prev => prev + price)
              onCardRemoved?.(item.card_id)
            }}
            onTraded={(item) => {
              setItems(prev => prev.filter(i => i.id !== item.id))
              setTradeCount(prev => prev + 1)
              onCardRemoved?.(item.card_id)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sales History Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {salesHistoryOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setSalesHistoryOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-700">💰 Sales History</h2>
                <button onClick={() => setSalesHistoryOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-sm">✕</button>
              </div>
              {salesHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No sales recorded yet.</p>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-1">
                  {salesHistory.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      {s.card_image && (
                        <img src={s.card_image} alt={s.card_name} className="w-10 rounded-lg flex-shrink-0 shadow-sm"
                             onError={e => { e.currentTarget.src = CARD_BACK }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{s.card_name}</p>
                        <p className="text-xs text-amber-600 font-semibold">${Number(s.sale_price).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(s.sold_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => deleteSaleRecord(s.id, Number(s.sale_price))}
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-400 hover:bg-red-200 text-xs"
                        title="Remove record"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trades History Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {tradesHistoryOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setTradesHistoryOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-700">🤝 Trades History</h2>
                <button onClick={() => setTradesHistoryOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-sm">✕</button>
              </div>
              {tradesHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No trades recorded yet.</p>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-1">
                  {tradesHistory.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-2.5 bg-sky-50 rounded-xl border border-sky-100">
                      {t.card_image && (
                        <img src={t.card_image} alt={t.card_name} className="w-10 rounded-lg flex-shrink-0 shadow-sm"
                             onError={e => { e.currentTarget.src = CARD_BACK }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{t.card_name}</p>
                        <p className="text-[10px] text-gray-400">{new Date(t.traded_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => deleteTradeRecord(t.id)}
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-400 hover:bg-red-200 text-xs"
                        title="Remove record"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Followed-card preview modal ─────────────────────────────── */}
      <AnimatePresence>
        {selectedFollowedCard && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setSelectedFollowedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedFollowedCard(null)}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 text-sm"
              >✕</button>
              <img src={selectedFollowedCard.image} alt={selectedFollowedCard.name} className="w-full rounded-xl mb-3 shadow-md"
                   onError={e => { e.currentTarget.src = CARD_BACK }} />
              <h3 className="text-base font-bold text-gray-700 mb-1">{selectedFollowedCard.name}</h3>
              {getDisplayPrice(selectedFollowedCard) > 0 && (
                <p className="text-sm font-semibold text-pink-500 mb-2">
                  ${getDisplayPrice(selectedFollowedCard).toFixed(2)}
                </p>
              )}
              <p className="text-xs text-gray-400">{selectedFollowedCard.owned ? '📦 In their collection' : '💖 On their wishlist'}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sold Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {soldModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setSoldModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-base font-bold text-gray-700 mb-1">💰 Mark as Sold</h2>
              <p className="text-sm text-gray-400 mb-4">
                <span className="font-semibold text-gray-600">{soldModal.name}</span> will be removed from your collection.
              </p>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sale price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={soldPrice}
                onChange={e => setSoldPrice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSold(soldModal, soldPrice) }}
                placeholder="e.g. 24.99"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-amber-300 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSoldModal(null)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200
                             text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSold(soldModal, soldPrice)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-400 text-white
                             hover:bg-amber-500 transition-colors"
                >
                  Confirm Sale
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pack Log History Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {packLogOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setPackLogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-700">🎴 Pack History</h2>
                <button onClick={() => setPackLogOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="mb-3 text-sm text-gray-500">
                Total invested: <span className="font-bold text-pink-500">${packInvested.toFixed(2)}</span>
              </div>
              {packLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No packs logged yet.<br/>Hit "Log a Pack" to start tracking!</p>
              ) : (
                <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                  {packLogs.map(log => (
                    <div key={log.id} className="border border-gray-100 rounded-xl p-3 flex items-start gap-3 group relative">
                      <div className="text-2xl">🎴</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-700 text-sm truncate">{log.pack_name}</div>
                        <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                          <span>{new Date(log.opened_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {log.store && <span>· 📍 {log.store}</span>}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="text-rose-500 font-medium">Paid: ${Number(log.pack_price).toFixed(2)}</span>
                          {log.total_value > 0 && <span className="text-emerald-600 font-medium">Pack worth: ${Number(log.total_value).toFixed(2)}</span>}
                        </div>
                        {(log.cards ?? []).length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {(log.cards ?? []).slice(0, 6).map((c, i) => (
                              <button
                                key={i}
                                onClick={() => setHistoryCard(c)}
                                className="relative hover:scale-110 transition-transform"
                                title={c.name}
                              >
                                <img src={c.image} alt={c.name} className="h-10 rounded-lg shadow-sm"
                                     onError={e => { e.currentTarget.src = CARD_BACK }} />
                              </button>
                            ))}
                            {(log.cards ?? []).length > 6 && (
                              <span className="text-xs text-gray-400 self-center">+{(log.cards ?? []).length - 6} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Delete button — visible on hover */}
                      <button
                        onClick={() => handleDeletePack(log.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center
                                   text-gray-300 hover:text-rose-400 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                        title="Delete this pack log"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setPackLogOpen(false); setPackModalOpen(true) }}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-pink-400 to-violet-400 text-white hover:opacity-90 transition"
              >
                + Log a New Pack
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pack history card preview ───────────────────────────────── */}
      <AnimatePresence>
        {historyCard && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setHistoryCard(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs flex flex-col items-center gap-4"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={historyCard.image}
                alt={historyCard.name}
                className="w-full max-w-[200px] rounded-xl shadow-lg"
                onError={e => { e.currentTarget.src = CARD_BACK }}
              />
              <div className="text-center">
                <div className="font-bold text-gray-700 text-base">{historyCard.name}</div>
                {historyCard.market_price > 0 && (
                  <div className="text-emerald-600 font-semibold text-sm mt-0.5">${Number(historyCard.market_price).toFixed(2)}</div>
                )}
              </div>
              <a
                href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(historyCard.name)}&view=grid`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                           bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:opacity-90 transition"
              >
                View on TCGPlayer →
              </a>
              <button
                onClick={() => setHistoryCard(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Log-a-Pack Modal ────────────────────────────────────────── */}
      {packModalOpen && (
        <PackLogModal
          user={user}
          onClose={() => setPackModalOpen(false)}
          onSaved={(log) => {
            setPackLogs(prev => [log, ...prev])
            setPackInvested(prev => prev + (log.pack_price || 0))
          }}
          onCardsSaved={cards => cards.forEach(c => onCardAdded?.(c.id, true, 'english'))}
        />
      )}

      {/* ── Trade Confirmation Modal ────────────────────────────────── */}
      <AnimatePresence>
        {tradeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setTradeModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-base font-bold text-gray-700 mb-1">🤝 Mark as Traded</h2>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you traded <span className="font-semibold text-gray-600">{tradeModal.name}</span>?
                It will be removed from your collection.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTradeModal(null)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200
                             text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTraded(tradeModal)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-sky-400 text-white
                             hover:bg-sky-500 transition-colors"
                >
                  Yes, Traded!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


