import { useState, useEffect, useCallback } from 'react'
import { supabase }        from './lib/supabase'
import AestheticFilter     from './components/AestheticFilter'
import CardGrid            from './components/CardGrid'
import WishlistDashboard   from './components/WishlistDashboard'
import HomePage            from './components/HomePage'
import Auth                from './components/Auth'
import Toast               from './components/Toast'
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
  const [collectionIds,  setCollectionIds]  = useState(new Set()) // all card IDs in wishlists table
  const [ownedIds,       setOwnedIds]       = useState(new Set()) // subset where owned = true

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
      else  { setProfile(null); setProfileReady(true); setCollectionIds(new Set()); setOwnedIds(new Set()) }
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
    const { data } = await supabase
      .from('wishlists')
      .select('card_id, owned')
      .eq('user_id', userId)
    const rows = data ?? []
    setCollectionIds(new Set(rows.map(r => r.card_id)))
    setOwnedIds(new Set(rows.filter(r => r.owned).map(r => r.card_id)))
  }

  // owned = false → wishlist entry; owned = true → collection entry
  function handleCardAdded(cardId, owned = false) {
    setCollectionIds(prev => new Set([...prev, cardId]))
    if (owned) setOwnedIds(prev => new Set([...prev, cardId]))
  }

  function handleCardRemoved(cardId) {
    setCollectionIds(prev => { const n = new Set(prev); n.delete(cardId); return n })
    setOwnedIds(prev => { const n = new Set(prev); n.delete(cardId); return n })
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

  const showToast     = useCallback((msg) => setToast(msg), [])
  const isHome        = activeVibe === 'home'
  const isWishlist    = activeVibe === 'wishlist'
  // Show modal when: logged in, profile fetch done, no username set, user hasn't skipped
  const needsUsername = user && profileReady && !profile?.username && !skippedSetup

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FFD1DC 0%, #FFF0F5 50%, #B2E2F2 100%)' }}>

      {/* ── Username setup modal ────────────────────────────────────────── */}
      {needsUsername && (
        <UsernameSetup user={user} onSaved={handleUsernameSaved} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="text-center pt-8 pb-2 px-4 space-y-2">
        <button
          onClick={goHome}
          className="text-4xl sm:text-5xl font-bold text-pink-500 drop-shadow-sm tracking-tight
                     cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
        >
          Poképop 🌸
        </button>
        <p className="text-pink-400 font-medium text-sm">
          Discover Pokémon cards by vibe ✨
        </p>
        <Auth user={user} username={profile?.username} />
      </header>

      {/* ── Filters — hidden on the home page ──────────────────────────── */}
      {!isHome && (
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
        {isHome ? (
          <HomePage
            user={user}
            collectionIds={collectionIds}
            ownedIds={ownedIds}
            onNavigate={vibe => { setActiveVibe(vibe); setSetQuery(null) }}
          />
        ) : isWishlist ? (
          <WishlistDashboard
            user={user}
            onToast={showToast}
            onGoExplore={() => { setActiveVibe('girlypop'); setSetQuery(null) }}
            onBinderChange={setActiveBinderId}
          />
        ) : (
          <CardGrid
            key={`${activeVibe ?? ''}|${setQuery ?? ''}`}
            activeVibe={activeVibe}
            setQuery={setQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            user={user}
            onToast={showToast}
            activeBinderId={activeBinderId}
            collectionIds={collectionIds}
            ownedIds={ownedIds}
            onCardAdded={handleCardAdded}
            onCardRemoved={handleCardRemoved}
          />
        )}
      </main>

      <Toast message={toast} onDone={() => setToast('')} />

      {/* ── Ko-fi FAB — fixed bottom-right on desktop, footer link on mobile ── */}
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

      {/* Mobile: centered footer link so it never blocks "Load More" */}
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
  )
}
