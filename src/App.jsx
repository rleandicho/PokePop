import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase }        from './lib/supabase'
import { fetchAllRows }    from './lib/fetchAllRows'
import { getStoredTheme, applyTheme } from './lib/theme'
import AestheticFilter     from './components/AestheticFilter'
import CardGrid            from './components/CardGrid'
import WishlistDashboard   from './components/WishlistDashboard'
import HomePageEditorial   from './components/HomePageEditorial'
import Auth                from './components/Auth'
import Toast               from './components/Toast'
import ThemeToggle         from './components/ThemeToggle'
import UsernameSetup       from './components/UsernameSetup'
import './index.css'

export default function App() {
  const [user,           setUser]           = useState(null)
  const [profile,        setProfile]        = useState(null)   // { id, username } | null
  const [profileReady,   setProfileReady]   = useState(false)  // has fetch completed?
  const [skippedSetup,   setSkippedSetup]   = useState(false)  // user clicked "maybe later"
  const [activeVibe,     setActiveVibe]     = useState('home')
  const [setQuery,       setSetQuery]       = useState(null)   // raw TCG query fragment
  const [sortBy,         setSortBy]         = useState('newest')
  const [toast,          setToast]          = useState('')
  const [activeBinderId, setActiveBinderId] = useState(null)   // tracks selected binder in Dashboard
  const [wishlistTab,    setWishlistTab]    = useState('collection') // which tab opens when navigating to wishlist
  const [collectionIds,       setCollectionIds]       = useState(new Set()) // all card IDs in wishlists table
  const [ownedIds,            setOwnedIds]            = useState(new Set()) // subset where owned = true
  const [collectionLanguages, setCollectionLanguages] = useState(new Map()) // card_id → string[]
  const [themeMode,      setThemeMode]      = useState(() => getStoredTheme())

  useEffect(() => { applyTheme(themeMode) }, [themeMode])

  // ── URL param: ?view=collection (from "Return to Poképop" on public profiles) ─
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'collection') {
      setActiveVibe('wishlist')
      // Clean the URL without a full reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Auth + profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) { fetchProfile(u.id); fetchCollectionIds(u.id) }
      else   setProfileReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) { fetchProfile(u.id); fetchCollectionIds(u.id) }
      else  { setProfile(null); setProfileReady(true); setCollectionIds(new Set()); setOwnedIds(new Set()); setCollectionLanguages(new Map()) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    setProfileReady(false)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
    setProfileReady(true)
  }

  async function fetchCollectionIds(userId) {
    const rows = await fetchAllRows(() =>
      supabase
        .from('wishlists')
        .select('card_id, owned, language')
        .eq('user_id', userId)
    )
    setCollectionIds(new Set(rows.map(r => r.card_id)))
    setOwnedIds(new Set(rows.filter(r => r.owned).map(r => r.card_id)))
    // Build language map: card_id → array of languages owned for that card
    const langMap = new Map()
    for (const r of rows) {
      const lang = r.language ?? 'english'
      if (!langMap.has(r.card_id)) langMap.set(r.card_id, [])
      if (!langMap.get(r.card_id).includes(lang)) langMap.get(r.card_id).push(lang)
    }
    setCollectionLanguages(langMap)
  }

  // owned = false → wishlist entry; owned = true → collection entry
  function handleCardAdded(cardId, owned = false, language = 'english') {
    setCollectionIds(prev => new Set([...prev, cardId]))
    if (owned) setOwnedIds(prev => new Set([...prev, cardId]))
    setCollectionLanguages(prev => {
      const next = new Map(prev)
      const langs = next.get(cardId) ?? []
      if (!langs.includes(language)) next.set(cardId, [...langs, language])
      return next
    })
  }

  function handleCardRemoved(cardId, language = null) {
    // If a specific language is removed and others remain, keep the card in collectionIds
    setCollectionLanguages(prev => {
      const next   = new Map(prev)
      const langs  = next.get(cardId) ?? []
      const remaining = language ? langs.filter(l => l !== language) : []
      if (remaining.length) {
        next.set(cardId, remaining)
      } else {
        next.delete(cardId)
        setCollectionIds(p => { const n = new Set(p); n.delete(cardId); return n })
        setOwnedIds(p => { const n = new Set(p); n.delete(cardId); return n })
      }
      return next
    })
  }

  function handleOwnedChanged(cardId, isNowOwned) {
    if (isNowOwned) {
      setOwnedIds(prev => new Set([...prev, cardId]))
    } else {
      setOwnedIds(prev => { const n = new Set(prev); n.delete(cardId); return n })
    }
  }

  function handleUsernameSaved(username) {
    if (username) {
      setProfile(prev => ({ ...(prev ?? { id: user.id }), username }))
      setSkippedSetup(false)
    } else {
      // User clicked "Maybe later" — suppress modal for this session
      setSkippedSetup(true)
    }
  }

  // ── Filter helpers ──────────────────────────────────────────────────────────
  function goHome() {
    setActiveVibe('home')
    setSetQuery(null)
  }

  function handleVibeChange(vibe) {
    // If vibe is toggled off (null), fall back to home — never leave a blank state
    setSetQuery(null)
    setActiveVibe(vibe ?? 'home')
  }

  function handleSetQuery(q) {
    // Only update the set filter — do NOT clear search or vibe so hybrid queries
    // (e.g. name:"*eevee*" set.id:base1) reach buildTcgQuery with all parts intact.
    setSetQuery(q)
  }

  function handleClearFilters() {
    setActiveVibe('all')
    setSetQuery(null)
  }

  const showToast     = useCallback((msg) => setToast(msg), [])
  const isHome        = activeVibe === 'home'
  const isWishlist    = activeVibe === 'wishlist'
  const isDark        = themeMode === 'dark'

  // ── Back-to-top visibility ──────────────────────────────────────────────────
  const [showBackTop, setShowBackTop] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Show modal when: logged in, profile fetch done, no username set, user hasn't skipped
  const needsUsername = user && profileReady && !profile?.username && !skippedSetup

  // ── Navigation callback shared by both home layouts ──────────────────────
  const [focusSearch, setFocusSearch] = useState(false)

  function handleNavigate(vibe, tab = 'collection', setId = null, nameQuery = null) {
    setActiveVibe(vibe)
    const parts = []
    if (setId)     parts.push(`set.id:${setId}`)
    if (nameQuery) parts.push(`name:*${nameQuery}*`)
    setSetQuery(parts.length ? parts.join(' ') : null)
    setWishlistTab(tab)
    setFocusSearch(false)
  }

  // Called when user clicks the home page search bar — navigates to browse AND focuses search input
  function handleNavigateToSearch() {
    setActiveVibe('all')
    setSetQuery(null)
    setFocusSearch(true)
  }

  const fadeTransition = { duration: 0.22, ease: 'easeInOut' }

  return (
    <>
      {needsUsername && <UsernameSetup user={user} onSaved={handleUsernameSaved} />}
      <Toast message={toast} onDone={() => setToast('')} />

      <AnimatePresence mode="wait">
        {isHome ? (
          <motion.div
            key="editorial-home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <HomePageEditorial
              user={user}
              profile={profile}
              collectionIds={collectionIds}
              ownedIds={ownedIds}
              onNavigate={handleNavigate}
              onNavigateToSearch={handleNavigateToSearch}
              isDark={isDark}
            />
            <ThemeToggle
              mode={themeMode}
              onToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
              className="fixed bottom-5 left-5 z-40 shadow-lg backdrop-blur-md"
            />
          </motion.div>
        ) : (
          <motion.div
            key="main-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <div className={`theme-shell ${isDark ? 'dark-theme' : ''}`}>

              {/* ── Header ─────────────────────────────────────────────────────── */}
              <header className="text-center pt-8 pb-2 px-4 space-y-3">
                <motion.button
                  onClick={goHome}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.97 }}
                  className="text-5xl sm:text-6xl font-bold theme-heading drop-shadow-md tracking-tight
                             cursor-pointer bg-transparent border-none p-0 transition-opacity
                             inline-flex items-center gap-3"
                  title="Back to home"
                >
                  Poképop
                  <span
                    className={`theme-ball ${isDark ? 'luxury-ball' : 'love-ball'}`}
                    style={{ width: '0.8em', height: '0.8em', flexShrink: 0 }}
                  >
                    <span className="theme-ball__top" />
                    <span className="theme-ball__band" />
                    <span className="theme-ball__button" />
                    <span className="theme-ball__mark">{isDark ? 'L' : '♥'}</span>
                  </span>
                </motion.button>
                <p className="theme-subtle font-medium text-sm">
                  Discover Pokémon cards by vibe ✨
                </p>
                <Auth user={user} username={profile?.username} isDark={isDark} />
              </header>

              {/* ── Filters — hidden on wishlist/collection view ───────────────── */}
              {!isWishlist && (
                <AestheticFilter
                  active={activeVibe}
                  onChange={handleVibeChange}
                  setQuery={setQuery}
                  onSetQuery={handleSetQuery}
                  user={user}
                />
              )}

              {/* ── Main content ────────────────────────────────────────────────── */}
              <main className="max-w-6xl mx-auto pb-16">
                {isWishlist ? (
                  <WishlistDashboard
                    key={wishlistTab}
                    user={user}
                    onToast={showToast}
                    onGoExplore={() => { setActiveVibe('all'); setSetQuery(null) }}
                    onBinderChange={setActiveBinderId}
                    initialTab={wishlistTab}
                    onCardRemoved={handleCardRemoved}
                    onOwnedChanged={handleOwnedChanged}
                  />
                ) : (
                  <CardGrid
                    key={`${activeVibe ?? ''}|${setQuery ?? ''}`}
                    activeVibe={activeVibe}
                    setQuery={setQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onClearFilters={handleClearFilters}
                    user={user}
                    onToast={showToast}
                    activeBinderId={activeBinderId}
                    collectionIds={collectionIds}
                    ownedIds={ownedIds}
                    collectionLanguages={collectionLanguages}
                    onCardAdded={handleCardAdded}
                    onCardRemoved={handleCardRemoved}
                    onOwnedChanged={handleOwnedChanged}
                    autoFocusSearch={focusSearch}
                    onSetQuery={handleSetQuery}
                  />
                )}
              </main>

              {/* ── Back to top ────────────────────────────────────────────────── */}
              {showBackTop && (
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="fixed bottom-6 right-4 z-50 sm:bottom-16 sm:right-5
                             w-9 h-9 flex items-center justify-center
                             bg-white/80 hover:bg-white text-pink-400 hover:text-pink-500
                             rounded-full border border-pink-200 shadow-md
                             transition-all hover:scale-110 active:scale-95 text-sm"
                  title="Back to top"
                  aria-label="Back to top"
                >
                  ↑
                </button>
              )}

              {/* ── Ko-fi FAB ── */}
              <a
                href="https://ko-fi.com/qakirap"
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-5 right-5 z-40
                           hidden sm:flex items-center gap-2
                           bg-white/80 hover:bg-white
                           text-pink-500 font-semibold text-sm
                           px-4 py-2.5 rounded-full
                           shadow-lg hover:shadow-xl
                           border border-pink-200
                           backdrop-blur-md
                           transition-all duration-200
                           hover:scale-105 active:scale-95"
              >
                ☕ Support on Ko-fi
              </a>

              {/* ── Theme toggle FAB ── */}
              <ThemeToggle
                mode={themeMode}
                onToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
                className="fixed bottom-5 left-5 z-40 shadow-lg backdrop-blur-md"
              />

              {/* Mobile footer Ko-fi link */}
              <footer className="sm:hidden text-center py-4 pb-6">
                <a
                  href="https://ko-fi.com/qakirap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5
                             text-xs text-pink-400 font-semibold
                             bg-white/60 hover:bg-white/90
                             px-4 py-2 rounded-full
                             border border-pink-200
                             shadow-sm transition-all"
                >
                  ☕ Support on Ko-fi
                </a>
              </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
