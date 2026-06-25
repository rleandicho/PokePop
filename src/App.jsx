import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase }        from './lib/supabase'
import { fetchAllRows }    from './lib/fetchAllRows'
import { getStoredTheme, applyTheme } from './lib/theme'
import AestheticFilter     from './components/AestheticFilter'
import CardGrid            from './components/CardGrid'
import SearchBar           from './components/SearchBar'
import WishlistDashboard   from './components/WishlistDashboard'
import HomePageEditorial   from './components/HomePageEditorial'
import CardScanner         from './components/CardScanner'
import Toast               from './components/Toast'
import ThemeToggle         from './components/ThemeToggle'
import UsernameSetup       from './components/UsernameSetup'
import './index.css'

// ── URL ↔ app-state mapping ───────────────────────────────────────────────────
// Path → { vibe, tab }
function pathToState(pathname, search) {
  const p = pathname.replace(/\/$/, '') || '/'
  const params = new URLSearchParams(search)
  if (p === '/' || p === '')           return { vibe: 'home',     tab: 'collection', setQuery: null }
  if (p === '/browse')                 return { vibe: 'all',      tab: 'collection', setQuery: params.get('set') }
  if (p.startsWith('/browse/'))        return { vibe: p.slice(8), tab: 'collection', setQuery: params.get('set') }
  if (p === '/collection')             return { vibe: 'wishlist',  tab: 'collection', setQuery: null }
  if (p === '/wishlist')               return { vibe: 'wishlist',  tab: 'wishlist',   setQuery: null }
  if (p === '/binder')                 return { vibe: 'wishlist',  tab: 'binder',     setQuery: null }
  if (p === '/lists')                  return { vibe: 'wishlist',  tab: 'lists',      setQuery: null }
  if (p === '/trainers')               return { vibe: 'wishlist',  tab: 'trainers',   setQuery: null }
  if (p === '/followers')              return { vibe: 'wishlist',  tab: 'followers',  setQuery: null }
  if (p === '/scan')                   return { vibe: 'scanner',   tab: 'collection', setQuery: null }
  return { vibe: 'home', tab: 'collection', setQuery: null }
}

// App state → URL path
function stateToPath(vibe, tab, sq) {
  if (vibe === 'home' || !vibe) return '/'
  if (vibe === 'wishlist') {
    if (tab === 'wishlist')   return '/wishlist'
    if (tab === 'binder')     return '/binder'
    if (tab === 'lists')      return '/lists'
    if (tab === 'trainers')   return '/trainers'
    if (tab === 'followers')  return '/followers'
    return '/collection'
  }
  if (vibe === 'scanner') return '/scan'
  if (vibe === 'all')  return sq ? `/browse?set=${encodeURIComponent(sq)}` : '/browse'
  return sq ? `/browse/${vibe}?set=${encodeURIComponent(sq)}` : `/browse/${vibe}`
}

export default function App() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const navSkipRef  = useRef(false)  // prevents URL-read → navigate → URL-read loops

  const [user,           setUser]           = useState(null)
  const [profile,        setProfile]        = useState(null)   // { id, username } | null
  const [profileReady,   setProfileReady]   = useState(false)  // has fetch completed?
  const [skippedSetup,   setSkippedSetup]   = useState(false)  // user clicked "maybe later"
  const [activeVibe,     setActiveVibe]     = useState(() => pathToState(location.pathname, location.search).vibe)
  const [setQuery,       setSetQuery]       = useState(() => pathToState(location.pathname, location.search).setQuery)   // raw TCG query fragment
  const [sortBy,         setSortBy]         = useState('newest')
  const [toast,          setToast]          = useState('')
  const [activeBinderId, setActiveBinderId] = useState(null)   // tracks selected binder in Dashboard
  const [wishlistTab,    setWishlistTab]    = useState(() => pathToState(location.pathname, location.search).tab)
  const [collectionIds,       setCollectionIds]       = useState(new Set()) // all card IDs in wishlists table
  const [ownedIds,            setOwnedIds]            = useState(new Set()) // subset where owned = true
  const [collectionLanguages, setCollectionLanguages] = useState(new Map()) // card_id → string[]
  const [themeMode,      setThemeMode]      = useState(() => getStoredTheme())

  // useLayoutEffect fires synchronously before paint so CSS vars (data-theme)
  // are applied in the same frame as the React render — prevents the one-frame
  // mismatch where inline styles reflect the new theme but the body background
  // still shows the old theme, which "blocked out" gradient text like "Welcome!".
  useLayoutEffect(() => { applyTheme(themeMode) }, [themeMode])

  // ── Initial URL correction (mount only) ────────────────────────────────────
  // On first load, if pathToState couldn't fully parse the URL (e.g. a legacy
  // ?view=collection param), correct it with a replace so no history entry is added.
  // All subsequent navigation uses push via the nav handlers below.
  useEffect(() => {
    const target  = stateToPath(activeVibe, wishlistTab, setQuery)
    const current = location.pathname + location.search
    if (target !== current) navigate(target, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL → state when the user navigates via browser back/forward.
  useEffect(() => {
    const { vibe, tab, setQuery: sq } = pathToState(location.pathname, location.search)
    setActiveVibe(vibe)
    setWishlistTab(tab)
    setSetQuery(sq)
  }, [location.pathname, location.search])

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

  // ── Navigation helpers ──────────────────────────────────────────────────────
  // Each handler updates React state AND pushes a new history entry so the
  // browser back button works correctly across sections.

  function goHome() {
    setActiveVibe('home')
    setSetQuery(null)
    navigate('/')
  }

  function handleVibeChange(vibe) {
    const v = vibe ?? 'home'
    setSetQuery(null)
    setActiveVibe(v)
    navigate(stateToPath(v, wishlistTab, null))
  }

  function handleSetQuery(q) {
    // Set-filter changes use replace so cycling through the set dropdown
    // doesn't flood the history stack.
    setSetQuery(q)
    navigate(stateToPath(activeVibe, wishlistTab, q), { replace: true })
  }

  function handleClearFilters() {
    setActiveVibe('all')
    setSetQuery(null)
    navigate('/browse')
  }

  function handleWishlistTabChange(tab) {
    setWishlistTab(tab)
    navigate(stateToPath('wishlist', tab, null))
  }

  const showToast     = useCallback((msg) => setToast(msg), [])
  const isHome        = activeVibe === 'home'
  const isWishlist    = activeVibe === 'wishlist'
  const isScanner     = activeVibe === 'scanner'
  const isDark        = themeMode === 'dark'

  // ── Header search bar state (desktop — lifted from CardGrid) ──────────────
  const [headerSearch,         setHeaderSearch]         = useState('')
  const [headerSearchDebounced, setHeaderSearchDebounced] = useState('')
  const headerSearchTimer = useRef(null)
  useEffect(() => {
    clearTimeout(headerSearchTimer.current)
    headerSearchTimer.current = setTimeout(() => setHeaderSearchDebounced(headerSearch.trim()), 500)
    return () => clearTimeout(headerSearchTimer.current)
  }, [headerSearch])
  // Reset when vibe changes so stale search doesn't carry over
  useEffect(() => { setHeaderSearch(''); setHeaderSearchDebounced('') }, [activeVibe])

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
    const sq = parts.length ? parts.join(' ') : null
    setSetQuery(sq)
    setWishlistTab(tab)
    setFocusSearch(false)
    navigate(stateToPath(vibe, tab, sq))
  }

  // Called when user clicks the home page search bar — navigates to browse AND focuses header search
  const headerSearchRef = useRef(null)
  function handleNavigateToSearch() {
    setActiveVibe('all')
    setSetQuery(null)
    setFocusSearch(true)
    navigate('/browse')
    setTimeout(() => headerSearchRef.current?.focus({ preventScroll: false }), 320)
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
              profileReady={profileReady}
              collectionIds={collectionIds}
              ownedIds={ownedIds}
              onNavigate={handleNavigate}
              onNavigateToSearch={handleNavigateToSearch}
              isDark={isDark}
              themeMode={themeMode}
              onThemeToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
              onCardAdded={handleCardAdded}
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

              {/* ── Top nav bar ─────────────────────────────────────────────────── */}
              {/* Mobile: flex justify-center so logo is centered (matches home page).
                  Desktop (sm+): 3-col grid so logo left, search center, nav right. */}
              <header
                className="flex items-center justify-center sm:grid"
                style={{
                  position: 'sticky', top: 0, zIndex: 40,
                  background: isDark ? 'rgba(21, 18, 39, 0.92)' : 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  borderBottom: `1px solid ${isDark ? 'rgba(192,132,252,0.22)' : 'rgba(244,114,182,0.28)'}`,
                  gridTemplateColumns: '1fr auto 1fr',
                  padding: '0 24px', height: 64, gap: 16,
                }}>
                {/* Left — logo */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <motion.button
                    onClick={goHome}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                    title="Back to home"
                  >
                    <span className="theme-heading" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      Poképop
                    </span>
                    <span
                      className={`theme-ball ${isDark ? 'luxury-ball' : 'love-ball'}`}
                      style={{ width: 22, height: 22, flexShrink: 0 }}
                    >
                      <span className="theme-ball__top" />
                      <span className="theme-ball__band" />
                      <span className="theme-ball__button" />
                      <span className="theme-ball__mark">{isDark ? 'L' : '♥'}</span>
                    </span>
                  </motion.button>
                </div>

                {/* Center — search bar on browse (desktop only) */}
                <div className="hidden sm:flex" style={{ width: 420, alignItems: 'center', justifyContent: 'center' }}>
                  {!isWishlist && !isScanner ? (
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: 14, fontSize: 14, pointerEvents: 'none', userSelect: 'none', zIndex: 1 }}>🔍</span>
                      <input
                        ref={headerSearchRef}
                        type="text"
                        value={headerSearch}
                        onChange={e => setHeaderSearch(e.target.value)}
                        placeholder="Search 18,000+ cards…"
                        style={{
                          width: '100%', paddingLeft: 38, paddingRight: headerSearch ? 36 : 16,
                          paddingTop: 9, paddingBottom: 9,
                          borderRadius: 999, fontSize: 13,
                          border: `1px solid ${isDark ? 'rgba(192,132,252,0.28)' : 'rgba(244,114,182,0.35)'}`,
                          background: isDark ? 'rgba(34,26,52,0.9)' : 'rgba(255,255,255,0.9)',
                          color: isDark ? '#d6d0e6' : '#374151',
                          outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                          fontFamily: 'inherit',
                        }}
                        onFocus={e => { e.target.style.boxShadow = `0 0 0 2px ${isDark ? 'rgba(192,132,252,0.4)' : 'rgba(244,114,182,0.4)'}` }}
                        onBlur={e => { e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)' }}
                      />
                      {headerSearch && (
                        <button
                          onClick={() => { setHeaderSearch(''); setHeaderSearchDebounced(''); headerSearchRef.current?.focus() }}
                          style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#8d82a8' : '#f9a8d4', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                          aria-label="Clear search"
                        >✕</button>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Right — nav links only (no auth, no toggle — toggle lives bottom-left) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <nav className="hidden sm:flex" style={{ gap: 2, alignItems: 'center' }}>
                    {[
                      { label: 'Home',          active: isHome,                                 onClick: goHome },
                      { label: 'Browse',        active: !isWishlist && !isScanner && !isHome,   onClick: () => handleNavigate('all') },
                      { label: 'My Collection', active: isWishlist && wishlistTab !== 'binder', onClick: () => handleNavigate('wishlist', 'collection') },
                      { label: 'My Binder',     active: isWishlist && wishlistTab === 'binder', onClick: () => handleNavigate('wishlist', 'binder') },
                    ].map(({ label, active, onClick }) => (
                      <button key={label} onClick={onClick} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '6px 12px', borderRadius: 8,
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        color: active ? (isDark ? '#c084fc' : '#ec4899') : (isDark ? '#8d82a8' : '#6b7280'),
                        fontFamily: 'inherit',
                        transition: 'color 0.15s',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}>{label}</button>
                    ))}
                  </nav>
                </div>
              </header>

              {/* ── Filters — hidden on wishlist/collection view ───────────────── */}
              {!isWishlist && !isScanner && (
                <AestheticFilter
                  active={activeVibe}
                  onChange={handleVibeChange}
                  setQuery={setQuery}
                  onSetQuery={handleSetQuery}
                />
              )}

              {/* ── Main content ────────────────────────────────────────────────── */}
              <main className="max-w-6xl mx-auto pb-24 sm:pb-16">
                {isScanner ? (
                  <CardScanner
                    user={user}
                    isDark={isDark}
                    onToast={showToast}
                    onCardAdded={handleCardAdded}
                    onBack={() => { setActiveVibe('all'); setSetQuery(null); navigate('/browse') }}
                  />
                ) : isWishlist ? (
                  <WishlistDashboard
                    key={wishlistTab}
                    user={user}
                    profile={profile}
                    onToast={showToast}
                    onGoExplore={() => { setActiveVibe('all'); setSetQuery(null); navigate('/browse') }}
                    onOpenScanner={() => { setActiveVibe('scanner'); setSetQuery(null); navigate('/scan') }}
                    onBinderChange={setActiveBinderId}
                    initialTab={wishlistTab}
                    onTabChange={handleWishlistTabChange}
                    onCardRemoved={handleCardRemoved}
                    onOwnedChanged={handleOwnedChanged}
                    onCardAdded={handleCardAdded}
                  />
                ) : (
                  <CardGrid
                    key={activeVibe ?? ''}
                    activeVibe={activeVibe}
                    search={headerSearchDebounced}
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
                    hideInlineSearch
                    onSetQuery={handleSetQuery}
                  />
                )}
              </main>

              {/* ── Back to top ────────────────────────────────────────────────── */}
              {showBackTop && (
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="fixed z-50 w-9 h-9 flex items-center justify-center
                             bg-white/80 hover:bg-white text-pink-400 hover:text-pink-500
                             rounded-full border border-pink-200 shadow-md
                             transition-all hover:scale-110 active:scale-95 text-sm"
                  style={{ bottom: 72, right: 16 }}
                  title="Back to top"
                  aria-label="Back to top"
                >
                  ↑
                </button>
              )}

              {/* ── Desktop Ko-fi FAB ── */}
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

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Persistent overlays — OUTSIDE AnimatePresence so opacity animations
          on motion.div don't create a stacking context that breaks position:fixed ── */}

      {/* Mobile ThemeToggle FAB — home page has its own, so only show on shell pages */}
      {!isHome && (
        <div
          className="sm:hidden fixed z-50"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: 16 }}
        >
          <ThemeToggle
            mode={themeMode}
            onToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
          />
        </div>
      )}

      {/* Desktop ThemeToggle FAB — always visible bottom-left on all pages */}
      <div className="hidden sm:block fixed z-40" style={{ bottom: 20, left: 20 }}>
        <ThemeToggle
          mode={themeMode}
          onToggle={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
        />
      </div>

      {/* Mobile bottom nav — shown on all non-home shell pages */}
      {!isHome && (
        <nav
          className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around"
          style={{
            background: isDark ? 'rgba(21, 18, 39, 0.95)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: `1px solid ${isDark ? 'rgba(192,132,252,0.22)' : 'rgba(244,114,182,0.25)'}`,
            paddingTop: 8,
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {[
            { id: 'home',    label: 'Home',    icon: '⌂', active: false,       onClick: goHome },
            { id: 'browse',  label: 'Browse',  icon: '▤', active: !isWishlist && !isScanner, onClick: () => handleVibeChange('all') },
            { id: 'scanner', label: 'Scan',    icon: '▣', active: isScanner,   onClick: () => handleNavigate('scanner') },
            { id: 'library', label: 'My Profile', icon: '⊞', active: isWishlist,  onClick: () => { if (!user) return; handleNavigate('wishlist', wishlistTab) } },
          ].map(tab => (
            <button key={tab.id} onClick={tab.onClick} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              color: tab.active ? (isDark ? '#c084fc' : '#ec4899') : (isDark ? '#5b5072' : '#9ca3af'),
              fontSize: 10, lineHeight: 1, padding: '2px 0',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ lineHeight: 1.2 }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  )
}
