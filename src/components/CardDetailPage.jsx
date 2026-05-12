import { useState, useEffect, useLayoutEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getStoredTheme, applyTheme } from '../lib/theme'

// ── Price helpers ─────────────────────────────────────────────────────────────
function bestPrice(card) {
  return card.best_market_price || card.normal_market || card.holofoil_market
    || card.reverse_holo_market || card.other_market || null
}

function priceVariants(card) {
  const variants = []
  if (card.normal_market)       variants.push({ label: 'Normal',       market: +card.normal_market,       low: card.normal_low       ? +card.normal_low       : null })
  if (card.holofoil_market)     variants.push({ label: 'Holofoil',     market: +card.holofoil_market,     low: card.holofoil_low     ? +card.holofoil_low     : null })
  if (card.reverse_holo_market) variants.push({ label: 'Reverse Holo', market: +card.reverse_holo_market, low: card.reverse_holo_low ? +card.reverse_holo_low : null })
  if (card.first_ed_holo_market)variants.push({ label: '1st Ed Holo',  market: +card.first_ed_holo_market,low: null })
  if (card.first_ed_normal_market) variants.push({ label: '1st Ed Normal', market: +card.first_ed_normal_market, low: null })
  if (card.other_market)        variants.push({ label: 'Other',        market: +card.other_market,        low: card.other_low        ? +card.other_low        : null })
  if (card.ebay_market)         variants.push({ label: 'eBay',         market: +card.ebay_market,         low: null })
  if (card.pricecharting_market)variants.push({ label: 'PriceCharting',market: +card.pricecharting_market,low: null })
  return variants
}

// ── Type colour map ───────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Grass:     'bg-green-100 text-green-700',
  Fire:      'bg-orange-100 text-orange-700',
  Water:     'bg-blue-100 text-blue-700',
  Lightning: 'bg-yellow-100 text-yellow-700',
  Psychic:   'bg-purple-100 text-purple-700',
  Fighting:  'bg-amber-100 text-amber-700',
  Darkness:  'bg-gray-800 text-gray-100',
  Metal:     'bg-slate-200 text-slate-700',
  Dragon:    'bg-indigo-100 text-indigo-700',
  Colorless: 'bg-gray-100 text-gray-600',
  Fairy:     'bg-pink-100 text-pink-700',
}

// ── Inline SVG card-back ──────────────────────────────────────────────────────
const CARD_BACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect width="250" height="350" fill="#1a56cc" rx="14"/><rect x="8" y="8" width="234" height="334" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" rx="10"/><circle cx="125" cy="175" r="78" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="5"/><circle cx="125" cy="175" r="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="3"/><line x1="47" y1="175" x2="203" y2="175" stroke="rgba(255,255,255,0.22)" stroke-width="4"/><circle cx="125" cy="175" r="15" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.18)" stroke-width="2"/><circle cx="125" cy="175" r="9" fill="#1a56cc"/></svg>')}`

// ── Price bar chart ───────────────────────────────────────────────────────────
function PriceChart({ variants, isDark }) {
  if (!variants.length) return null
  const max = Math.max(...variants.map(v => v.market))
  return (
    <div className="space-y-2.5">
      {variants.map(v => (
        <div key={v.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{v.label}</span>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              ${v.market.toFixed(2)}
              {v.low != null && v.low !== v.market && (
                <span className={`ml-2 font-normal text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  low ${v.low.toFixed(2)}
                </span>
              )}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all duration-700"
              style={{ width: `${Math.max(4, (v.market / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CardDetailPage() {
  const { cardId }  = useParams()
  const navigate    = useNavigate()
  const [card,      setCard]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [user,      setUser]      = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [inList,    setInList]    = useState(false)
  const [isOwned,   setIsOwned]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')
  const [themeMode, setThemeMode] = useState(() => getStoredTheme())
  const [imgSrc,    setImgSrc]    = useState(null)

  useLayoutEffect(() => { applyTheme(themeMode) }, [themeMode])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id); else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('id,username').eq('id', userId).maybeSingle()
    setProfile(data ?? null)
  }

  // Fetch card
  useEffect(() => {
    if (!cardId) return
    setLoading(true)
    supabase
      .from('tcg_cards_with_price')
      .select(`
        id, name, english_name, card_language, supertype, subtypes, hp, types,
        evolves_from, number, artist, rarity, flavor_text,
        set_id, set_name, series, release_date,
        image_small, image_large,
        best_market_price, normal_market, normal_mid, normal_low,
        holofoil_market, holofoil_mid, holofoil_low,
        reverse_holo_market, reverse_holo_low,
        first_ed_holo_market, first_ed_normal_market,
        other_market, other_low, ebay_market, pricecharting_market, price_source
      `)
      .eq('id', cardId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else {
          setCard(data)
          setImgSrc(data.image_large || data.image_small || CARD_BACK)
        }
        setLoading(false)
      })
  }, [cardId])

  // Check wishlist status
  useEffect(() => {
    if (!user || !cardId) return
    supabase
      .from('wishlists')
      .select('id, owned')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .then(({ data }) => {
        if (data?.length) {
          setInList(true)
          setIsOwned(data.some(r => r.owned))
        }
      })
  }, [user, cardId])

  async function addCard(owned) {
    if (!user || !card) return
    setSaving(true)
    const { error } = await supabase.from('wishlists').upsert({
      user_id:  user.id,
      card_id:  card.id,
      owned,
      quantity: 1,
      language: 'english',
      edition:  '',
    }, { onConflict: 'user_id,card_id,edition,language' })
    if (!error) {
      setInList(true)
      if (owned) setIsOwned(true)
      setToast(owned ? 'Added to Collection! ✨📦' : 'Added to Wishlist! 💖')
    }
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const isDark   = themeMode === 'dark'
  const bp       = card ? bestPrice(card) : null
  const variants = card ? priceVariants(card) : []

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-pink-50'}`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading card…</p>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 px-4 ${isDark ? 'bg-gray-950 text-white' : 'bg-pink-50 text-gray-800'}`}>
        <p className="text-6xl">🃏</p>
        <h1 className="text-2xl font-bold">Card not found</h1>
        <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          This card doesn't exist in our database yet.
        </p>
        <Link to="/" className="px-5 py-2.5 bg-pink-500 text-white rounded-full font-semibold text-sm hover:bg-pink-600 transition-colors">
          ← Back to Poképop
        </Link>
      </div>
    )
  }

  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent((card.english_name || card.name) + ' pokemon card')}&_sacat=2536`

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-pink-50'}`}>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-white rounded-full shadow-lg border border-pink-200 text-sm font-semibold text-pink-600 transition-all">
          {toast}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-10 border-b backdrop-blur-md ${isDark ? 'bg-gray-950/85 border-gray-800' : 'bg-pink-50/85 border-pink-100'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors shrink-0 ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-pink-100 text-gray-600'}`}
          >
            ← Back
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-bold theme-heading tracking-tight">Poképop</span>
            <span className={`theme-ball ${isDark ? 'luxury-ball' : 'love-ball'}`} style={{ width: '1.1rem', height: '1.1rem' }}>
              <span className="theme-ball__top" />
              <span className="theme-ball__band" />
              <span className="theme-ball__button" />
              <span className="theme-ball__mark">{isDark ? 'L' : '♥'}</span>
            </span>
          </Link>

          {/* Right: user indicator + theme */}
          <div className="flex items-center gap-2 shrink-0">
            {profile?.username && (
              <span className={`text-xs font-semibold hidden sm:block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                @{profile.username}
              </span>
            )}
            {!user && (
              <Link to="/" className="hidden sm:block text-xs font-semibold text-pink-500 hover:text-pink-600 transition-colors">
                Sign in
              </Link>
            )}
            <button
              onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
              className={`text-base w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-yellow-300' : 'hover:bg-pink-100 text-gray-600'}`}
              title="Toggle theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Hero section: image + primary info ── */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* Card image */}
          <div className="flex justify-center lg:justify-start lg:w-72 shrink-0">
            <div className="relative group">
              <img
                src={imgSrc}
                alt={card.name}
                onError={() => setImgSrc(CARD_BACK)}
                className="w-60 sm:w-72 rounded-2xl shadow-2xl object-contain
                           group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          </div>

          {/* Primary info panel */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Name + set breadcrumb */}
            <div>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {card.series && card.series !== card.set_name ? `${card.series} › ` : ''}{card.set_name}
                {card.number ? ` · #${card.number}` : ''}
                {card.release_date ? ` · ${card.release_date.slice(0,4)}` : ''}
              </p>
              <h1 className={`text-3xl sm:text-4xl font-extrabold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {card.name}
              </h1>
              {card.english_name && card.english_name !== card.name && (
                <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{card.english_name}</p>
              )}
            </div>

            {/* Metadata pills */}
            <div className="flex flex-wrap gap-2">
              {card.rarity && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isDark ? 'bg-yellow-900/40 text-yellow-300 border-yellow-800' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                  {card.rarity}
                </span>
              )}
              {card.supertype && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isDark ? 'bg-blue-900/40 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {card.supertype}
                </span>
              )}
              {Array.isArray(card.subtypes) && card.subtypes.map(s => (
                <span key={s} className={`px-3 py-1 rounded-full text-xs font-bold border ${isDark ? 'bg-purple-900/40 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                  {s}
                </span>
              ))}
              {Array.isArray(card.types) && card.types.map(t => (
                <span key={t} className={`px-3 py-1 rounded-full text-xs font-bold ${TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t}
                </span>
              ))}
              {card.hp && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isDark ? 'bg-red-900/40 text-red-300 border-red-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {card.hp} HP
                </span>
              )}
            </div>

            {/* Price spotlight */}
            {bp != null && (
              <div className={`rounded-2xl p-4 ${isDark ? 'bg-gray-800/60 border border-gray-700' : 'bg-white border border-pink-100 shadow-sm'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Market Price
                </p>
                <p className="text-4xl font-extrabold text-pink-500">${bp.toFixed(2)}</p>
                {card.price_source && (
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    via {card.price_source}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              {user ? (
                inList ? (
                  <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold ${isDark ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    <span>✓</span>
                    {isOwned ? 'In your Collection' : 'On your Wishlist'} · <span className="underline cursor-pointer" onClick={() => navigate('/collection')}>View</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => addCard(true)}
                      disabled={saving}
                      className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl transition-colors disabled:opacity-60 text-sm"
                    >
                      {saving ? '…' : '✨ Add to Collection'}
                    </button>
                    <button
                      onClick={() => addCard(false)}
                      disabled={saving}
                      className={`flex-1 font-bold py-3 rounded-2xl transition-colors disabled:opacity-60 text-sm border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-white/10' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
                    >
                      {saving ? '…' : '💖 Wishlist'}
                    </button>
                  </div>
                )
              ) : (
                <Link
                  to="/"
                  className="block text-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl transition-colors text-sm"
                >
                  Sign in to save this card
                </Link>
              )}

              {/* External links */}
              <div className="flex gap-2">
                <a
                  href={ebayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex-1 flex items-center justify-center gap-1.5 font-semibold py-2.5 rounded-2xl transition-colors text-sm border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>🛒</span> eBay
                </a>
                <button
                  onClick={copyLink}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-semibold py-2.5 rounded-2xl transition-colors text-sm border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  {copied ? '✓ Copied!' : '🔗 Share'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────────── */}
        <div className={`my-10 border-t ${isDark ? 'border-gray-800' : 'border-pink-100'}`} />

        {/* ── Lower sections ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* About this card */}
          <section className={`rounded-2xl p-6 ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-pink-100 shadow-sm'}`}>
            <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>About This Card</h2>

            {card.flavor_text && (
              <blockquote className={`italic text-sm leading-relaxed mb-5 pl-3 border-l-2 border-pink-300 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                "{card.flavor_text}"
              </blockquote>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {card.hp && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>HP</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.hp}</dd>
                </>
              )}
              {Array.isArray(card.types) && card.types.length > 0 && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Type</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.types.join(', ')}</dd>
                </>
              )}
              {card.evolves_from && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Evolves from</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.evolves_from}</dd>
                </>
              )}
              {card.artist && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Artist</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.artist}</dd>
                </>
              )}
              {card.set_name && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Set</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.set_name}</dd>
                </>
              )}
              {card.release_date && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Released</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>{card.release_date}</dd>
                </>
              )}
              {card.card_language && (
                <>
                  <dt className={`font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Language</dt>
                  <dd className={isDark ? 'text-gray-200' : 'text-gray-700'}>
                    {{ en: 'English', ja: 'Japanese', 'zh-tw': 'Chinese (TW)', 'zh-cn': 'Chinese (CN)', fr: 'French', de: 'German', ko: 'Korean' }[card.card_language] ?? card.card_language}
                  </dd>
                </>
              )}
            </dl>
          </section>

          {/* Price breakdown */}
          <section className={`rounded-2xl p-6 ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-pink-100 shadow-sm'}`}>
            <h2 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>Price by Variant</h2>

            {variants.length > 0 ? (
              <PriceChart variants={variants} isDark={isDark} />
            ) : (
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No pricing data available yet.</p>
            )}

            {variants.length > 0 && (
              <p className={`text-[10px] mt-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                Prices are market averages cached from TCGPlayer{card.ebay_market ? ', eBay' : ''}{card.pricecharting_market ? ', and PriceCharting' : ''}.
              </p>
            )}
          </section>
        </div>

        {/* ── Browse CTA ────────────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <Link
            to="/browse"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-colors border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-white/10' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
          >
            Browse all cards on Poképop →
          </Link>
        </div>
      </main>
    </div>
  )
}
