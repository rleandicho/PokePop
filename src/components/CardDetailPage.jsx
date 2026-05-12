import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getStoredTheme, applyTheme } from '../lib/theme'

// Resolve best display price
function getPrice(card) {
  return card.market_price || card.mid_price || card.low_price || null
}

export default function CardDetailPage() {
  const { cardId }   = useParams()
  const navigate     = useNavigate()
  const [card, setCard]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [user, setUser]       = useState(null)
  const [added, setAdded]     = useState(false)
  const [adding, setAdding]   = useState(false)
  const [themeMode, setThemeMode] = useState(() => getStoredTheme())

  useEffect(() => { applyTheme(themeMode) }, [themeMode])

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch card
  useEffect(() => {
    if (!cardId) return
    setLoading(true)
    supabase
      .from('tcg_cards_with_price')
      .select('id, name, set_id, set_name, series, rarity, number, image_url, market_price, mid_price, low_price, language, supertype, subtypes')
      .eq('id', cardId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else { setCard(data) }
        setLoading(false)
      })
  }, [cardId])

  // Check if already in collection
  useEffect(() => {
    if (!user || !cardId) return
    supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .eq('owned', true)
      .maybeSingle()
      .then(({ data }) => { if (data) setAdded(true) })
  }, [user, cardId])

  async function addToCollection() {
    if (!user || !card) return
    setAdding(true)
    await supabase.from('wishlists').upsert({
      user_id: user.id,
      card_id: card.id,
      owned: true,
      quantity: 1,
      language: 'english',
    }, { onConflict: 'user_id,card_id,edition,language' })
    setAdded(true)
    setAdding(false)
  }

  async function addToWishlist() {
    if (!user || !card) return
    setAdding(true)
    await supabase.from('wishlists').upsert({
      user_id: user.id,
      card_id: card.id,
      owned: false,
      quantity: 1,
      language: 'english',
    }, { onConflict: 'user_id,card_id,edition,language' })
    setAdded(true)
    setAdding(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isDark = themeMode === 'dark'
  const price  = card ? getPrice(card) : null

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950 text-white' : 'bg-pink-50 text-gray-800'}`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm opacity-60">Loading card…</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 px-4 ${isDark ? 'bg-gray-950 text-white' : 'bg-pink-50 text-gray-800'}`}>
        <p className="text-6xl">🃏</p>
        <h1 className="text-2xl font-bold">Card not found</h1>
        <p className="text-sm opacity-60 text-center">This card doesn't exist in our database.</p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-pink-500 text-white rounded-full font-semibold text-sm hover:bg-pink-600 transition-colors"
        >
          ← Back to Poképop
        </Link>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-white' : 'bg-pink-50 text-gray-800'}`}>
      {/* Header bar */}
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md ${isDark ? 'bg-gray-950/80 border-gray-800' : 'bg-pink-50/80 border-pink-100'}`}>
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-pink-300' : 'hover:bg-pink-100 text-pink-500'}`}
        >
          ← Back
        </button>

        <Link to="/" className="text-xl font-bold tracking-tight" style={{ background: 'linear-gradient(135deg, #ec4899, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Poképop
        </Link>

        <button
          onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
          className={`text-lg px-2 py-1 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-pink-100'}`}
          title="Toggle theme"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className={`rounded-3xl overflow-hidden shadow-2xl ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-pink-100'}`}>
          <div className="flex flex-col sm:flex-row">
            {/* Card image */}
            <div className={`flex items-center justify-center p-6 sm:p-10 ${isDark ? 'bg-gray-800/50' : 'bg-gradient-to-br from-pink-50 to-purple-50'}`}>
              {card.image_url ? (
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-56 sm:w-64 rounded-xl shadow-xl object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className={`w-56 sm:w-64 aspect-[2.5/3.5] rounded-xl flex items-center justify-center text-6xl ${isDark ? 'bg-gray-700' : 'bg-pink-100'}`}>
                  🃏
                </div>
              )}
            </div>

            {/* Card details */}
            <div className="flex-1 p-6 sm:p-8 flex flex-col gap-4">
              {/* Name + number */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{card.name}</h1>
                {card.number && (
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    #{card.number}
                  </p>
                )}
              </div>

              {/* Metadata pills */}
              <div className="flex flex-wrap gap-2">
                {card.set_name && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                    {card.set_name}
                  </span>
                )}
                {card.rarity && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>
                    {card.rarity}
                  </span>
                )}
                {card.supertype && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                    {card.supertype}
                  </span>
                )}
                {card.language && card.language !== 'english' && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                    {card.language.charAt(0).toUpperCase() + card.language.slice(1)}
                  </span>
                )}
              </div>

              {/* Price */}
              {price != null && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Market price
                  </p>
                  <p className="text-3xl font-bold text-pink-500">
                    ${price.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 mt-auto pt-2">
                {user ? (
                  added ? (
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold ${isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-600'}`}>
                      <span>✓</span> In your Poképop
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={addToCollection}
                        disabled={adding}
                        className="flex-1 px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-60"
                      >
                        {adding ? '…' : '+ Add to Collection'}
                      </button>
                      <button
                        onClick={addToWishlist}
                        disabled={adding}
                        className={`flex-1 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-white/10' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
                      >
                        {adding ? '…' : '+ Wishlist'}
                      </button>
                    </div>
                  )
                ) : (
                  <Link
                    to="/"
                    className="block text-center px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
                    Sign in to add to your collection
                  </Link>
                )}

                <button
                  onClick={copyLink}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-pink-50'}`}
                >
                  {copied ? '✓ Link copied!' : '🔗 Copy card link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Browse more CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/browse"
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-white/10' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
          >
            Browse all cards on Poképop
          </Link>
        </div>
      </main>
    </div>
  )
}
