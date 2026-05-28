import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase.js'

// ─── Vibe definitions ─────────────────────────────────────────────────────────
const VIBES = [
  { id: 'girlypop',    label: 'Girlypop 🌸',           color: 'bg-pink-200 text-pink-700' },
  { id: 'space',       label: 'Space ✨',               color: 'bg-indigo-200 text-indigo-700' },
  { id: 'pastel',      label: 'Pastel 🍬',              color: 'bg-yellow-100 text-yellow-600' },
  { id: 'cottagecore', label: 'Cottagecore 🌿',         color: 'bg-green-200 text-green-700' },
  { id: 'darkfairy',   label: 'Dark Fairy 🖤',          color: 'bg-purple-200 text-purple-700' },
  { id: 'nature',      label: 'Nature 🌱',              color: 'bg-emerald-200 text-emerald-700' },
  { id: 'fullart',     label: 'Full Art 🎨',            color: 'bg-fuchsia-200 text-fuchsia-700' },
  { id: 'trainers',    label: 'Trainers & Supports 🃏', color: 'bg-orange-100 text-orange-600' },
  { id: 'starters',       label: 'Starters 🔥',            color: 'bg-red-100 text-red-600' },
  { id: 'dragons',        label: 'Dragons 🐉',             color: 'bg-blue-200 text-blue-700' },
  { id: 'megaevolution',  label: 'Mega Evolution ⚡',      color: 'bg-orange-200 text-orange-700' },
]

// ─── Sets cache — memory + localStorage with 24-hour TTL ─────────────────────
// v7: grouped by language tab, then series within each language
const LS_KEY    = 'pokepop_sets_v7'
const TTL_MS    = 24 * 60 * 60 * 1000
const PROMO_KEY = 'Promos'
const PROMO_QUERY = '(set.name:"*Promo*" OR subtypes:PROMO OR set.name:"*POP Series*" OR set.name:"*McDonald*")'

// Human-readable labels for each language code
const LANG_LABELS = {
  'en':    '🇺🇸 English',
  'ja':    '🇯🇵 Japanese',
  'fr':    '🇫🇷 French',
  'de':    '🇩🇪 German',
  'zh-tw': '🇹🇼 Chinese (TW)',
  'zh-cn': '🇨🇳 Chinese (CN)',
  'zh':    '🇨🇳 Chinese',
}

// Ordered list of known language prefixes (longest first to avoid zh matching zh-tw)
const LANG_PREFIXES = ['zh-tw', 'zh-cn', 'zh', 'ja', 'fr', 'de', 'it', 'pt', 'ko', 'es']

// English translations for foreign-language set names, keyed by set ID
const SET_EN_NAMES = {
  // ── Japanese MEGA series ─────────────────────────────────────────────────
  'ja-M5':   'Abyss Eye',
  'ja-M3':   'Nihil Zero',
  'ja-M1S':  'Mega Symphonia',
  // ── Japanese Scarlet & Violet ────────────────────────────────────────────
  'ja-SV11B': 'Black Bolt',
  'ja-SV11W': 'White Flare',
  'ja-SV10':  'Glory of Team Rocket',
  'ja-SV9a':  'Sizzling Showdown',
  'ja-SV9':   'Battle Partners',
  'ja-SV8a':  'Terastal Festival ex',
  'ja-SV8':   'Super Electric Breaker',
  'ja-SV7a':  'Paradise Dragona',
  'ja-SVLS':  'Starter Set Stellar: Ceruledge ex',
  'ja-SVLN':  'Starter Set Stellar: Sylveon ex',
  'ja-SVK':   'Deck Build Box: Stellar Miracle',
  'ja-SV7':   'Stellar Miracle',
  'ja-SV6':   'Mask of Change',
  'ja-SV5a':  'Crimson Haze',
  'ja-SV5K':  'Wild Force',
  'ja-SV4a':  'Raging Surf',
  'ja-SV4K':  'Ancient Roar',
  'ja-SV4M':  'Future Flash',
  'ja-SV3a':  'Raging Surf',
  'ja-SV3':   'Ruler of the Black Flame',
  'ja-SV2a':  'Pokémon Card 151',
  'ja-SV2P':  'Snow Hazard',
  'ja-SV2D':  'Clay Burst',
  'ja-SV1S':  'Scarlet ex',
  'ja-SV1V':  'Violet ex',
  // ── Japanese Sword & Shield ──────────────────────────────────────────────
  'ja-S12a':  'VSTAR Universe',
  'ja-S12':   'Paradigm Trigger',
  'ja-S9a':   'Battle Region',
  'ja-S9':    'Star Birth',
  // ── Japanese PCG (ex era) ────────────────────────────────────────────────
  'ja-PCG9':  'Offense and Defense of the Furthest Ends',
  'ja-PCG8':  'Crystal of the Phantom',
  'ja-PCG7':  'Holon Phantom',
  'ja-PCG6':  'Holon Research Tower',
  'ja-PCG5':  "Illusion's Forest",
  'ja-PCG4':  'Golden Sky, Silvery Ocean',
  'ja-PCG3':  'Rocket Gang Strikes Back',
  'ja-PCG2':  'Blue Sky Stream',
  'ja-PCG1':  'Legendary Flight',
  // ── Japanese e-series (ADV era) ──────────────────────────────────────────
  'ja-E5':    'Mysterious Mountains',
  'ja-E4':    'Split Earth',
  'ja-E3':    'Wind from the Sea',
  'ja-E2':    'The Town on No Map',
  'ja-E1':    'Base Expansion Pack',
  // ── Japanese Neo ─────────────────────────────────────────────────────────
  'ja-neo4':  'Darkness, and to Light...',
  'ja-neo3':  'Awakening Legends',
  'ja-neo2':  'Beyond the Ancient Ruins...',
  'ja-neo1':  'Gold, Silver, to a New World...',
  // ── Japanese Original (PMCG) ─────────────────────────────────────────────
  'ja-PMCG1': 'Expansion Pack',
  'ja-PMCG2': 'Pokémon Jungle',
  'ja-PMCG3': 'Mystery of the Fossils',
  'ja-PMCG4': 'Team Rocket',
  'ja-PMCG5': "Leader's Stadium",
  'ja-PMCG6': 'Challenge from the Darkness',
  // ── Japanese Web / VS ────────────────────────────────────────────────────
  'ja-web1':  'Pokémon Card★web',
  'ja-VS1':   'Pokémon Card★VS',
}

function getLangFromSetId(setId) {
  for (const prefix of LANG_PREFIXES) {
    if (setId.startsWith(prefix + '-')) return prefix
  }
  return 'en'
}

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
  } catch (_) { /* corrupt entry — fall through to DB */ }

  // 3. Fetch from Supabase tcg_sets (no rate limits — our own data)
  const { data: rows, error } = await supabase
    .from('tcg_sets')
    .select('id, name, series, release_date, printed_total, total')
    .order('release_date', { ascending: false })

  if (error) throw error

  const sets = (rows ?? [])
    // Filter out sets with zero printed cards — they appear empty when browsed
    .filter(s => s.printed_total == null || s.printed_total > 0)
    .map(s => ({
      id:          s.id,
      name:        s.name,
      series:      s.series,
      releaseDate: s.release_date,
      lang:        getLangFromSetId(s.id),
    }))

  // Group by language → series → sets
  const byLang = {}
  for (const s of sets) {
    if (!byLang[s.lang]) byLang[s.lang] = { grouped: {} }
    const n = s.name?.toLowerCase() ?? ''
    const isPromo = n.includes('promo') || n.includes('pop series') || n.includes('mcdonald')
    const key = isPromo ? PROMO_KEY : (s.series?.trim() || 'Other')
    if (!byLang[s.lang].grouped[key]) byLang[s.lang].grouped[key] = []
    byLang[s.lang].grouped[key].push(s)
  }

  // Sort sets within each series newest → oldest; build series order per language
  for (const lang of Object.keys(byLang)) {
    const { grouped } = byLang[lang]
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
    }
    const mainOrder = Object.keys(grouped)
      .filter(k => k !== PROMO_KEY)
      .sort((a, b) => new Date(grouped[b][0].releaseDate) - new Date(grouped[a][0].releaseDate))
    byLang[lang].order = grouped[PROMO_KEY]
      ? [mainOrder[0], PROMO_KEY, ...mainOrder.slice(1)]
      : mainOrder
  }

  // Language tab order: English first, then by set count descending
  const langOrder = Object.keys(byLang).sort((a, b) => {
    if (a === 'en') return -1
    if (b === 'en') return 1
    const countA = Object.values(byLang[a].grouped).flat().length
    const countB = Object.values(byLang[b].grouped).flat().length
    return countB - countA
  })

  setsCache = { byLang, langOrder }

  // 4. Persist to localStorage for next page load
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), payload: setsCache }))
  } catch (_) { /* storage full — fine, session cache still works */ }

  return setsCache
}

// ─── Component ────────────────────────────────────────────────────────────────
function AestheticFilter({ active, onChange, setQuery, onSetQuery }) {
  const [setsOpen,    setSetsOpen]    = useState(false)
  const [vibesOpen,   setVibesOpen]   = useState(false)
  const [setGroups,   setSetGroups]   = useState({ byLang: {}, langOrder: [] })
  const [activeLang,  setActiveLang]  = useState('en')
  const [loadingSets, setLoadingSets] = useState(false)

  useEffect(() => {
    if (!setsOpen) return
    if (setsCache) { setSetGroups(setsCache); return }
    setLoadingSets(true)
    fetchSets().then(data => {
      setSetGroups(data)
      setLoadingSets(false)
    })
  }, [setsOpen])

  function handleVibe(id) {
    onSetQuery(null)
    onChange(id === active ? 'home' : id)
  }

  function handleSetClick(setId) {
    const q = `set.id:${setId}`
    onSetQuery(setQuery === q ? null : q)
  }

  const activeSetQuery = setQuery?.startsWith('set.id:') ? setQuery : null

  // A vibe is "active" if it's not 'all', 'home', 'wishlist', and not null
  const vibeIsActive = active && active !== 'all' && active !== 'home' && active !== 'wishlist'

  // Shared base class — full-width so the grid controls sizing
  const navBtn = 'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm'

  return (
    <div className="px-4 pb-2 max-w-2xl mx-auto">

      {/* ── Always 2-col grid: Browse by Vibe | Browse by Set ──────────── */}
      <div className="grid grid-cols-2 gap-3 pt-3 pb-1">

        {/* 1. Browse by Vibe */}
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setVibesOpen(o => !o); setSetsOpen(false) }}
          className={`${navBtn}
            ${vibesOpen || vibeIsActive
              ? 'bg-gradient-to-r from-pink-100 to-violet-100 text-violet-700 ring-2 ring-offset-1 ring-violet-300 shadow-md'
              : 'bg-white/60 text-gray-500 hover:bg-white/80'
            }`}
        >
          🎨 Browse by Vibe
          <motion.span
            animate={{ rotate: vibesOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block leading-none text-xs"
          >
            ▾
          </motion.span>
        </motion.button>

        {/* 2. Browse by Set */}
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setSetsOpen(o => !o); setVibesOpen(false) }}
          className={`${navBtn}
            ${setsOpen || setQuery
              ? 'bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-300 shadow-md'
              : 'bg-white/60 text-gray-500 hover:bg-white/80'
            }`}
        >
          📚 Browse by Set
          <motion.span
            animate={{ rotate: setsOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block leading-none text-xs"
          >
            ▾
          </motion.span>
        </motion.button>
      </div>

      {/* ── Vibe pills (expands below grid) ────────────────────────────── */}
      <AnimatePresence>
        {vibesOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap justify-center gap-2 pt-3 pb-1 border-t border-white/40 mt-2">
              {VIBES.map(v => (
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sets tile grid (expands below grid) ────────────────────────── */}
      <AnimatePresence>
        {setsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-white/40">

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

              {/* Language tabs */}
              {!loadingSets && setGroups.langOrder.length > 0 && (
                <div className="flex flex-wrap gap-1 pb-3 px-1">
                  {setGroups.langOrder.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all
                        ${activeLang === lang
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-white/60 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                    >
                      {LANG_LABELS[lang] ?? lang}
                    </button>
                  ))}
                </div>
              )}

              {/* Set tile grid — grouped by series with section labels */}
              {!loadingSets && (
                <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-4 px-1 pb-2">
                  {(setGroups.byLang[activeLang]?.order ?? []).map(series => {
                    const sets = setGroups.byLang[activeLang]?.grouped[series] ?? []
                    return (
                      <div key={series}>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1 mb-1.5">
                          {series}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {sets.map(set => {
                            const setQ     = `set.id:${set.id}`
                            const isActive = activeSetQuery === setQ
                            return (
                              <motion.button
                                key={set.id}
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => handleSetClick(set.id)}
                                className={`text-left px-3 py-2 rounded-xl text-xs transition-all shadow-sm border
                                  ${isActive
                                    ? 'bg-pink-100 text-pink-800 border-pink-300 font-semibold ring-1 ring-pink-300'
                                    : 'bg-white/70 text-gray-600 border-white/60 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200'
                                  }`}
                              >
                                {SET_EN_NAMES[set.id] ? (
                                  <>
                                    <div className="font-semibold leading-tight truncate">{SET_EN_NAMES[set.id]}</div>
                                    <div className="text-[10px] opacity-50 truncate leading-tight">{set.name}</div>
                                  </>
                                ) : (
                                  <div className="font-semibold leading-tight truncate">{set.name}</div>
                                )}
                                {set.releaseDate && (
                                  <div className="text-[10px] opacity-60 mt-0.5">{set.releaseDate.slice(0, 4)}</div>
                                )}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(AestheticFilter)
