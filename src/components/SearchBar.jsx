import { useEffect, useRef } from 'react'

// ─── SearchBar ─────────────────────────────────────────────────────────────────
// Pure display component — debounce logic lives in the parent (CardGrid).
// Props:
//   value       — controlled input value
//   onChange    — called on every keystroke (parent handles debounce timing)
//   onClear     — fired when the ✕ button is clicked (immediate, no debounce)
//   placeholder — optional placeholder string
//   autoFocus   — when true, focuses the input on mount (e.g. after navigating from home search)
export default function SearchBar({ value, onChange, onClear, placeholder = 'Search Pokémon…', autoFocus = false }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Longer delay lets the AnimatePresence fade-in complete before focusing.
      // preventScroll avoids jarring jumps on mobile.
      const t = setTimeout(() => inputRef.current?.focus({ preventScroll: false }), 300)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  return (
    <div className="relative flex items-center mx-4 mb-2">
      {/* Magnifying-glass icon */}
      <span
        className="absolute left-3.5 text-pink-300 text-base pointer-events-none select-none"
        aria-hidden="true"
      >
        🔍
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-pink-200 bg-white/70
                   text-sm text-gray-600 placeholder-pink-300
                   focus:outline-none focus:ring-2 focus:ring-pink-300
                   shadow-sm transition-all"
      />

      {/* Clear button — only visible when there is text */}
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3.5 text-pink-300 hover:text-pink-500
                     transition-colors text-lg leading-none"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}
