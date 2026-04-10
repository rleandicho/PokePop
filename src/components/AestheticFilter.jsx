import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Vibe definitions ─────────────────────────────────────────────────────────
const VIBES = [
  { id: 'all',         label: 'All Cards 🌐',          color: 'bg-sky-100 text-sky-700' },
  { id: 'girlypop',    label: 'Girlypop 🌸',           color: 'bg-pink-200 text-pink-700' },
  { id: 'space',       label: 'Space ✨',               color: 'bg-indigo-200 text-indigo-700' },
  { id: 'pastel',      label: 'Pastel 🍬',              color: 'bg-yellow-100 text-yellow-600' },
  { id: 'cottagecore', label: 'Cottagecore 🌿',         color: 'bg-green-200 text-green-700' },
  { id: 'darkfairy',   label: 'Dark Fairy 🖤',          color: 'bg-purple-200 text-purple-700' },
  { id: 'nature',      label: 'Nature 🌱',              color: 'bg-emerald-200 text-emerald-700' },
  { id: 'fullart',     label: 'Full Art 🎨',            color: 'bg-fuchsia-200 text-fuchsia-700' },
  { id: 'trainers',   label: 'Trainers 🃏',            color: 'bg-orange-100 text-orange-600'  },
]

// ─── Sets cache — memory + localStorage with 24-hour TTL ─────────────────────
const LS_KEY = 'pokepop_sets_v1'
const TTL_MS = 24 * 60 * 60 * 1000

let setsCache = null   // in-memory reference to avoid re-parsing localStorage

async function fetchSets() {
  // 1. Return in-memory cache immediately (same session, already parsed)
  if (setsCache) return setsCache

  // 2. Try localStorage (survives page reload within 24 h)
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const { ts, payload } = JSON.parse(raw)
      if (Date.now() - ts < TTL_MS) {
        setsCache = payload
        return setsCache
      }
    }
  } catch (_) { /* corrupt entry — fall through to network */ }

  // 3. Fetch from TCG API (pageSize=250 is the API maximum)
  const res  = await fetch(
    'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250&select=id,name,series,releaseDate'
  )
  const data = await res.json()
  const sets = data.data ?? []

  // Group ALL sets by series — sets without a series fall under 'Other'
  const grouped = {}
  for (const s of sets) {
    const key = s.series?.trim() || 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }

  // Sort sets within each series newest → oldest
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
  }

  // Sort series headers by their newest set's releaseDate (newest series first)
  const order = Object.keys(grouped).sort((a, b) =>
    new Date(grouped[b][0].releaseDate) - new Date(grouped[a][0].releaseDate)
  )

  setsCache = { grouped, order }

  // 4. Persist to localStorage for next page load
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), payload: setsCache }))
  } catch (_) { /* storage full — fine, session cache still works */ }

  return setsCache
}

// ─── Component ────────────────────────────────────────────────────────────────
function AestheticFilter({ active, onChange, setQuery, onSetQuery, user }) {
  const [setsOpen,       setSetsOpen]       = useState(false)
  const [setGroups,      setSetGroups]      = useState({ grouped: {}, order: [] })
  const [expandedSeries, setExpandedSeries] = useState(null)
  const [loadingSets,    setLoadingSets]    = useState(false)

  useEffect(() => {
    if (!setsOpen) return
    if (setsCache) { setSetGroups(setsCache); return }
    setLoadingSets(true)
    fetchSets().then(data => {
      setSetGroups(data)
      setLoadingSets(false)
    })
  }, [setsOpen])

  const vibes = user
    ? [...VIBES, { id: 'wishlist', label: 'Wishlist & Collection ✨📦', color: 'bg-rose-200 text-rose-700' }]
    : VIBES

  function handleVibe(id) {
    onSetQuery(null)
    // Toggling the active pill off snaps back to girlypop, never leaves a null state
    onChange(id === active ? 'girlypop' : id)
  }

  function handleSeriesClick(series) {
    onChange(null)
    setExpandedSeries(expandedSeries === series ? null : series)
    const q = `set.series:"${series}"`
    onSetQuery(setQuery === q ? null : q)
  }

  function handleSetClick(setId) {
    onChange(null)
    const q = `set.id:${setId}`
    onSetQuery(setQuery === q ? null : q)
  }

  const activeSeriesQuery = setQuery?.startsWith('set.series:') ? setQuery : null
  const activeSetQuery    = setQuery?.startsWith('set.id:')     ? setQuery : null

  return (
    <div className="px-4 pb-2 max-w-4xl mx-auto">

      {/* ── Vibe pills ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 py-3">
        {vibes.map(v => (
          <motion.button
            key={v.id}
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
            onClick={() => handleVibe(v.id)}
            className={`px-4 py-2 rounded-full font-semibold text-sm transition-all shadow-sm
              ${active === v.id
                ? `${v.color} ring-2 ring-offset-1 ring-pink-400 shadow-md`
                : 'bg-white/60 text-gray-500 hover:bg-white/80'
              }`}
          >
            {v.label}
          </motion.button>
        ))}
      </div>

      {/* ── Browse Sets toggle ──────────────────────────────────────────── */}
      <div className="flex justify-center mb-1">
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => setSetsOpen(o => !o)}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold
                      transition-all border shadow-sm
                      ${setsOpen || setQuery
                        ? 'bg-sky-100 text-sky-600 border-sky-200'
                        : 'bg-white/60 text-gray-400 border-white/60 hover:bg-white/80'
                      }`}
        >
          <span>📚 Browse Sets</span>
          <motion.span
            animate={{ rotate: setsOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block leading-none"
          >
            ▾
          </motion.span>
        </motion.button>
      </div>

      {/* ── Sets accordion ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {setsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/40 mt-1 pt-2 max-h-64 overflow-y-auto
                            scrollbar-thin space-y-0.5 px-2 max-w-4xl mx-auto">

              {loadingSets && (
                <div className="flex items-center justify-center gap-2 py-4 text-pink-400 text-xs font-medium">
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 border-pink-200 border-t-pink-500"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  />
                  Loading sets…
                </div>
              )}

              {setGroups.order.map(series => {
                const sets        = setGroups.grouped[series] ?? []
                const isExpanded  = expandedSeries === series
                const seriesQ     = `set.series:"${series}"`
                const isSeriesAct = activeSeriesQuery === seriesQ

                return (
                  <div key={series}>
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => handleSeriesClick(series)}
                        className={`flex-1 text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                          ${isSeriesAct
                            ? 'bg-sky-200 text-sky-700'
                            : 'text-gray-600 hover:bg-sky-50 hover:text-sky-600'
                          }`}
                      >
                        {series}
                        <span className="ml-1 text-gray-400 font-normal">({sets.length})</span>
                      </motion.button>

                      <button
                        onClick={() => setExpandedSeries(isExpanded ? null : series)}
                        className="p-1 text-gray-400 hover:text-sky-500 transition-colors"
                      >
                        <motion.span
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.15 }}
                          className="inline-block text-xs leading-none"
                        >
                          ▶
                        </motion.span>
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden pl-3"
                        >
                          <div className="flex flex-wrap gap-1 py-1.5">
                            {sets.map(set => {
                              const setQ     = `set.id:${set.id}`
                              const isActive = activeSetQuery === setQ
                              return (
                                <motion.button
                                  key={set.id}
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                                  onClick={() => handleSetClick(set.id)}
                                  className={`px-2.5 py-1 rounded-full text-xs transition-all shadow-sm
                                    ${isActive
                                      ? 'bg-pink-300 text-pink-800 font-semibold ring-1 ring-pink-400'
                                      : 'bg-white/70 text-gray-500 hover:bg-pink-50 hover:text-pink-600'
                                    }`}
                                >
                                  {set.name}
                                </motion.button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(AestheticFilter)
