import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const BINDER_SIZES = [
  { id: '1x1', cols: 1, label: '1×1' },
  { id: '2x2', cols: 2, label: '2×2' },
  { id: '3x3', cols: 3, label: '3×3' },
]

const COVER_PRESETS = [
  { label: 'Pastel Pink',   hex: '#f9a8d4' },
  { label: 'Galaxy Purple', hex: '#a78bfa' },
  { label: 'Mint Green',    hex: '#6ee7b7' },
  { label: 'Midnight',      hex: '#1e1b4b' },
  { label: 'Sky Blue',      hex: '#7dd3fc' },
  { label: 'Crimson',       hex: '#fb7185' },
  { label: 'Gold',          hex: '#fbbf24' },
]

const DEFAULT_THEME = { coverColor: '#a78bfa', pageStyle: 'white' }

// ─── Utils ────────────────────────────────────────────────────────────────────
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function hexAlpha(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Build a flat slot array of length `totalSlots` from `items`.
 * Items that carry a valid slot_index are placed there first.
 * Remaining items fill leftover null slots in order.
 */
function buildSlotArray(items, totalSlots) {
  const arr = Array(totalSlots).fill(null)

  // Pass 1: place items with an explicit slot_index
  const unplaced = []
  for (const item of items) {
    const idx = item.slot_index
    if (idx != null && idx >= 0 && idx < totalSlots && arr[idx] === null) {
      arr[idx] = item
    } else {
      unplaced.push(item)
    }
  }

  // Pass 2: fill remaining items into the first available gaps
  let cursor = 0
  for (const item of unplaced) {
    while (cursor < totalSlots && arr[cursor] !== null) cursor++
    if (cursor < totalSlots) arr[cursor] = item
  }

  return arr
}

// ─── Empty "Chase Hole" slot ──────────────────────────────────────────────────
function EmptySlot({ isSelected, pageStyle, onClick, readOnly }) {
  const dark       = pageStyle === 'black'
  const strokeColor = isSelected
    ? 'rgba(251,191,36,0.7)'
    : dark ? 'rgba(255,255,255,0.18)' : 'rgba(147,197,253,0.55)'

  return (
    <motion.div
      onClick={readOnly ? undefined : onClick}
      animate={isSelected ? { y: -4, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={`relative rounded-xl overflow-hidden flex items-center justify-center ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
      style={{
        aspectRatio: '2.5 / 3.5',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'manipulation',
        background: isSelected
          ? 'linear-gradient(145deg, rgba(251,191,36,0.18), rgba(251,191,36,0.08))'
          : dark
            ? 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))'
            : 'linear-gradient(145deg, rgba(219,234,254,0.35), rgba(236,254,255,0.2))',
        border: isSelected
          ? '2px solid #fbbf24'
          : `1.5px dashed ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(147,197,253,0.5)'}`,
        boxShadow: isSelected
          ? '0 0 0 3px rgba(251,191,36,0.25), 0 0 18px rgba(251,191,36,0.2)'
          : 'none',
      }}
    >
      {readOnly ? (
        /* Transparent Pokéball outline — no interactive affordance in guest view */
        <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
          <circle cx="20" cy="20" r="15" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="5" y1="20" x2="35" y2="20" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="5" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="2.5" fill={strokeColor} />
        </svg>
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: isSelected
              ? 'rgba(251,191,36,0.2)'
              : dark ? 'rgba(255,255,255,0.06)' : 'rgba(147,197,253,0.15)',
            border: `1px solid ${isSelected ? 'rgba(251,191,36,0.4)' : dark ? 'rgba(255,255,255,0.1)' : 'rgba(147,197,253,0.3)'}`,
          }}
        >
          <span
            className="text-xl leading-none font-extralight select-none"
            style={{
              color: isSelected
                ? 'rgba(251,191,36,0.8)'
                : dark ? 'rgba(255,255,255,0.2)' : 'rgba(147,197,253,0.65)',
            }}
          >
            {isSelected ? '✦' : '+'}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Filled card slot ─────────────────────────────────────────────────────────
function CardSlot({ item, isSelected, pageStyle, onClick, binders, onTransfer, currentBinderId, onCardClick, readOnly }) {
  const dark        = pageStyle === 'black'
  const [showMenu, setShowMenu] = useState(false)
  // Show the action menu whenever the owner has the onTransfer callback (even if
  // there are no other binders, "Remove from binder" is always available)
  const canShowMenu = !readOnly && !!onTransfer
  const otherBinders = binders?.filter(b => b.id !== currentBinderId) ?? []

  return (
    <motion.div
      onClick={onClick}
      animate={isSelected ? { y: -6, scale: 1.04 } : { y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      whileHover={!isSelected ? { scale: 1.04, zIndex: 10 } : {}}
      className="relative rounded-xl cursor-pointer"
      style={{
        aspectRatio: '2.5 / 3.5',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'manipulation',
        border: isSelected
          ? '2px solid #fbbf24'
          : `1.5px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.75)'}`,
        boxShadow: isSelected
          ? '0 0 0 3px rgba(251,191,36,0.3), 0 0 22px rgba(251,191,36,0.25), 0 8px 24px rgba(0,0,0,0.2)'
          : dark
            ? '0 2px 8px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: isSelected || showMenu ? 20 : undefined,
      }}
    >
      {/* ── Clipped visual layer (image + glare) — overflow hidden here only ── */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
        {/* Plastic sleeve glare */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)',
          }}
        />
        {/* Sleeve bottom edge shimmer */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'rgba(255,255,255,0.35)' }}
        />
      </div>

      {/* ── Badges (outside overflow:hidden so they render on top cleanly) ── */}
      {item.owned && (
        <div
          className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold
                     bg-emerald-400/90 text-white rounded-full w-4 h-4
                     flex items-center justify-center shadow-sm pointer-events-none"
        >
          ✓
        </div>
      )}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 z-30 text-[11px] leading-none
                     bg-amber-400 text-white rounded-full w-5 h-5
                     flex items-center justify-center shadow-md pointer-events-none"
        >
          🌸
        </motion.div>
      )}

      {/* ── Info button — hidden when card is selected (🌸 badge takes that spot) ── */}
      {onCardClick && !readOnly && !isSelected && (
        <button
          onClick={e => { e.stopPropagation(); onCardClick(item) }}
          className="absolute top-1.5 right-1.5 z-30 w-4 h-4 rounded-full
                     bg-black/35 hover:bg-black/60 text-white text-[8px]
                     flex items-center justify-center backdrop-blur-sm transition-all
                     leading-none font-bold pointer-events-auto"
          title="View card details"
        >ℹ</button>
      )}

      {/* ── Action menu (move / remove) ────────────────────────────────────── */}
      {canShowMenu && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center z-30">
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(m => !m) }}
              className="bg-black/40 hover:bg-black/65 text-white text-[9px] font-bold
                         px-2 py-0.5 rounded-full backdrop-blur-sm transition-all leading-none"
              title="Card actions"
            >
              ↗ Move
            </button>

            {showMenu && (
              <>
                {/* Backdrop — click outside to close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={e => { e.stopPropagation(); setShowMenu(false) }}
                />
                {/* Dropdown */}
                <div
                  className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50
                             bg-white rounded-2xl shadow-2xl
                             border border-pink-100 overflow-hidden"
                  style={{ minWidth: '130px' }}
                >
                  {/* Remove from binder — always available */}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      onTransfer(item.id, null)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5
                               text-xs font-semibold text-red-400 hover:bg-red-50
                               transition-colors text-left border-b border-pink-50"
                  >
                    <span>✕</span>
                    <span>Remove from binder</span>
                  </button>

                  {/* Move to another binder — only when others exist */}
                  {otherBinders.length > 0 && (
                    <p className="text-[9px] text-pink-400 font-bold uppercase tracking-widest px-3 pt-2.5 pb-1">
                      Move to…
                    </p>
                  )}
                  {otherBinders.map(b => (
                      <button
                        key={b.id}
                        onClick={e => {
                          e.stopPropagation()
                          onTransfer(item.id, b.id)
                          setShowMenu(false)
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2.5
                                   text-xs font-semibold text-gray-600 hover:bg-pink-50
                                   transition-colors text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: b.color ?? '#a78bfa' }}
                        />
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Single binder page ────────────────────────────────────────────────────────
function BinderPage({ slots, cols, pageNumber, theme, selectedIdx, pageOffset, onSlotClick, binders, onTransfer, currentBinderId, readOnly, onCardClick }) {
  const { coverColor, pageStyle } = theme
  const dark = pageStyle === 'black'

  const pageBackground = dark
    ? 'linear-gradient(160deg, #1a1a1a 0%, #111111 60%, #1c1c1e 100%)'
    : 'linear-gradient(160deg, #fffdf7 0%, #fef9ed 60%, #fffbf2 100%)'
  const pageBorderColor = hexAlpha(coverColor, 0.25)
  const dividerColor    = dark ? 'rgba(255,255,255,0.06)' : hexAlpha(coverColor, 0.15)
  const pageNumColor    = dark ? 'rgba(255,255,255,0.2)' : 'rgba(156,163,175,0.8)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full relative max-w-xl mx-auto"
    >
      {/* ── Binding strip ─────────────────────────────────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 w-6 rounded-l-2xl z-10"
        style={{
          background: `linear-gradient(to right, ${coverColor}, ${hexAlpha(coverColor, 0.7)}, ${hexAlpha(coverColor, 0.35)})`,
          boxShadow: `inset -3px 0 6px rgba(0,0,0,0.18), 2px 0 0 ${hexAlpha(coverColor, 0.3)}`,
        }}
      />
      {[18, 50, 82].map(pct => (
        <div
          key={pct}
          className="absolute left-1 w-4 h-4 rounded-full z-20"
          style={{
            top: `${pct}%`,
            transform: 'translateY(-50%)',
            background: `radial-gradient(circle at 38% 32%, #ffffff, ${hexAlpha(coverColor, 0.6)})`,
            border: `1.5px solid ${hexAlpha(coverColor, 0.45)}`,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.18)',
          }}
        />
      ))}

      {/* ── Page body ─────────────────────────────────────────────────────── */}
      <div
        className="ml-6 rounded-r-2xl py-5 px-4"
        style={{
          background: pageBackground,
          border: `1px solid ${pageBorderColor}`,
          boxShadow: dark
            ? '4px 4px 20px rgba(0,0,0,0.5), 1px 0 0 rgba(0,0,0,0.3)'
            : `4px 4px 18px rgba(0,0,0,0.09), 1px 0 0 ${hexAlpha(coverColor, 0.08)}`,
        }}
      >
        <p
          className="text-[10px] font-medium text-right mb-3 pr-0.5 tracking-wide"
          style={{ color: pageNumColor }}
        >
          {pageNumber}
        </p>

        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {slots.map((item, slotInPage) => {
            const globalIdx = pageOffset + slotInPage
            const isSel     = selectedIdx === globalIdx
            return item ? (
              <CardSlot
                key={globalIdx}
                item={item}
                isSelected={isSel}
                pageStyle={pageStyle}
                onClick={() => onSlotClick(globalIdx)}
                binders={binders}
                onTransfer={onTransfer}
                currentBinderId={currentBinderId}
                onCardClick={onCardClick}
                readOnly={readOnly}
              />
            ) : (
              <EmptySlot
                key={globalIdx}
                isSelected={isSel}
                pageStyle={pageStyle}
                onClick={() => onSlotClick(globalIdx)}
                readOnly={readOnly}
              />
            )
          })}
        </div>

        <div className="mt-4 h-px rounded-full" style={{ background: dividerColor }} />
      </div>
    </motion.div>
  )
}

// ─── Theme controls ───────────────────────────────────────────────────────────
function ThemeControls({ theme, onThemeChange, binderSize, onSizeChange }) {
  const colorInputRef = useRef(null)
  const isPreset      = COVER_PRESETS.some(p => p.hex === theme.coverColor)

  return (
    <div className="flex flex-col items-center gap-4 mb-8">
      {/* Grid size */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium">Grid</span>
        {BINDER_SIZES.map(sz => (
          <motion.button
            key={sz.id}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
            onClick={() => onSizeChange(sz.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-sm
              ${binderSize === sz.id
                ? 'bg-violet-400 text-white border-violet-400'
                : 'bg-white/60 text-gray-500 border-gray-200 hover:bg-white/80'
              }`}
          >
            {sz.label}
          </motion.button>
        ))}
      </div>

      {/* Cover color */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs text-gray-400 font-medium">Cover</span>
        {COVER_PRESETS.map(preset => (
          <motion.button
            key={preset.hex}
            whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
            onClick={() => onThemeChange({ coverColor: preset.hex })}
            title={preset.label}
            className="w-6 h-6 rounded-full shadow-sm transition-all"
            style={{
              background: preset.hex,
              border: theme.coverColor === preset.hex ? '2.5px solid #374151' : '2px solid rgba(0,0,0,0.12)',
              outline: theme.coverColor === preset.hex ? '2px solid white' : 'none',
              outlineOffset: '-3px',
            }}
          />
        ))}
        <motion.button
          whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
          onClick={() => colorInputRef.current?.click()}
          title="Custom color"
          className="w-6 h-6 rounded-full shadow-sm flex items-center justify-center text-[10px] transition-all"
          style={{
            border: !isPreset ? '2.5px solid #374151' : '2px solid rgba(0,0,0,0.12)',
            background: !isPreset ? theme.coverColor : 'rgba(255,255,255,0.7)',
          }}
        >
          {isPreset ? '✎' : ''}
        </motion.button>
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          value={theme.coverColor}
          onChange={e => onThemeChange({ coverColor: e.target.value })}
        />
      </div>

      {/* Page style */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium">Pages</span>
        {['white', 'black'].map(style => (
          <motion.button
            key={style}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
            onClick={() => onThemeChange({ pageStyle: style })}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border shadow-sm capitalize
              ${theme.pageStyle === style
                ? style === 'black'
                  ? 'bg-gray-900 text-white border-gray-700'
                  : 'bg-white text-gray-700 border-gray-300 shadow-md'
                : 'bg-white/40 text-gray-400 border-gray-200 hover:bg-white/70'
              }`}
          >
            {style === 'white' ? '☀ White' : '✦ Black'}
          </motion.button>
        ))}
      </div>

      {/* Hint text */}
      <p className="text-[11px] text-pink-300 font-medium">
        🌸 Tap a card to select it, then tap another slot to move it
      </p>
    </div>
  )
}

// ─── Main BinderView ──────────────────────────────────────────────────────────
export default function BinderView({ items, user, readOnly = false, initialTheme, onThemeChange, binders, onTransfer, currentBinderId, onCardClick, onSlotsSwapped }) {
  const [binderSize,   setBinderSize]   = useState('3x3')
  const [theme,        setTheme]        = useState(initialTheme ?? DEFAULT_THEME)
  const [slotArray,    setSlotArray]    = useState([])
  const [selectedIdx,  setSelectedIdx]  = useState(null)

  function patchTheme(patch) {
    setTheme(prev => {
      const next = { ...prev, ...patch }
      onThemeChange?.(next)
      return next
    })
  }

  const cfg          = BINDER_SIZES.find(s => s.id === binderSize)
  const slotsPerPage = cfg.cols * cfg.cols

  // Rebuild slotArray whenever items or grid size changes.
  // Uses slot_index from DB when available; fills gaps sequentially otherwise.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / slotsPerPage))
    const totalSlots = totalPages * slotsPerPage
    setSlotArray(buildSlotArray(items, totalSlots))
    setSelectedIdx(null)
  }, [items, slotsPerPage])

  // ── Click-to-swap handler ─────────────────────────────────────────────────
  const handleSlotClick = useCallback((globalIdx) => {
    if (readOnly) {
      const item = slotArray[globalIdx]
      if (item && onCardClick) onCardClick(item)
      return
    }

    setSelectedIdx(prev => {
      // First click: select this slot
      if (prev === null) return globalIdx

      // Same slot clicked: deselect
      if (prev === globalIdx) return null

      // Two empty slots: deselect without swapping
      const itemA = slotArray[prev]
      const itemB = slotArray[globalIdx]
      if (!itemA && !itemB) return null

      // Perform the swap optimistically
      setSlotArray(arr => {
        const next      = [...arr]
        next[prev]      = itemB
        next[globalIdx] = itemA
        return next
      })

      // Notify parent so its items state stays in sync (used by moveCardToBinder
      // to compute the next available slot index without a DB round-trip)
      const swaps = []
      if (itemA) swaps.push({ id: itemA.id, slot_index: globalIdx })
      if (itemB) swaps.push({ id: itemB.id, slot_index: prev })
      if (swaps.length) onSlotsSwapped?.(swaps)

      // Persist to Supabase using row id (not card_id — multi-edition safe)
      if (user) {
        const ops = []
        if (itemA) ops.push(
          supabase.from('wishlists')
            .update({ slot_index: globalIdx })
            .eq('id', itemA.id)
        )
        if (itemB) ops.push(
          supabase.from('wishlists')
            .update({ slot_index: prev })
            .eq('id', itemB.id)
        )
        Promise.all(ops)  // errors are silent; local slotArray is source of truth
      }

      return null  // deselect after swap
    })
  }, [slotArray, user, readOnly, onCardClick, onSlotsSwapped])

  const pages = chunk(slotArray, slotsPerPage)

  return (
    <div className="px-4 pb-16">

      {/* ── Controls (owner only) ──────────────────────────────────────── */}
      {!readOnly && (
        <ThemeControls
          theme={theme}
          onThemeChange={patchTheme}
          binderSize={binderSize}
          onSizeChange={setBinderSize}
        />
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <p className="text-center text-pink-300 font-semibold text-sm mb-6">
          Add cards to your collection to fill your binder ✨
        </p>
      )}

      {/* ── Page wall ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${binderSize}-${theme.pageStyle}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-8"
        >
          {pages.map((slots, pageIdx) => (
            <BinderPage
              key={pageIdx}
              slots={slots}
              cols={cfg.cols}
              pageNumber={pageIdx + 1}
              theme={readOnly ? DEFAULT_THEME : theme}
              selectedIdx={selectedIdx}
              pageOffset={pageIdx * slotsPerPage}
              onSlotClick={handleSlotClick}
              binders={binders}
              onTransfer={onTransfer}
              currentBinderId={currentBinderId}
              readOnly={readOnly}
              onCardClick={onCardClick}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
