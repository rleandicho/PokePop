import { useState, useEffect } from 'react'

// ── Featured card carousel — in production feed from /api/featured-cards
const FEATURED_CARDS = [
  {
    name: 'Charizard',
    set: 'Base Set',
    rarity: 'Holo Rare',
    tagline: 'The original holo. Where the obsession started.',
    subtitle: 'Featured today',
    image: 'https://images.pokemontcg.io/base1/4_hires.png',
    hue: 20,
  },
  {
    name: 'Lugia',
    set: 'Neo Genesis',
    rarity: 'Holo Rare',
    tagline: 'Sea guardian, mythic.',
    subtitle: 'Popular in your region',
    image: 'https://images.pokemontcg.io/neo4/9_hires.png',
    hue: 220,
  },
  {
    name: 'Mew ex',
    set: 'Scarlet & Violet 151',
    rarity: 'Ultra Rare',
    tagline: 'Whispered into existence.',
    subtitle: 'Newly indexed',
    image: 'https://images.pokemontcg.io/sv3pt5/205_hires.png',
    hue: 305,
  },
]

// ── Vibes — matches existing vibe IDs, with editorial palette
const VIBES = [
  { id: 'girlypop',    label: 'Girlypop',    emoji: '🌸', desc: 'Cute & soft',       bg: 'oklch(82% 0.10 0)',   ink: 'oklch(35% 0.10 0)' },
  { id: 'space',       label: 'Space',       emoji: '✨', desc: 'Cosmic & celestial', bg: 'oklch(78% 0.09 240)', ink: 'oklch(30% 0.09 240)' },
  { id: 'darkfairy',   label: 'Dark Fairy',  emoji: '🖤', desc: 'Mysterious vibes',   bg: 'oklch(72% 0.10 290)', ink: 'oklch(98% 0.02 290)' },
  { id: 'cottagecore', label: 'Cottagecore', emoji: '🌿', desc: 'Cozy & botanical',   bg: 'oklch(85% 0.10 145)', ink: 'oklch(32% 0.10 145)' },
  { id: 'nature',      label: 'Nature',      emoji: '🌱', desc: 'Grass-type gallery', bg: 'oklch(80% 0.13 130)', ink: 'oklch(28% 0.10 130)' },
  { id: 'pastel',      label: 'Pastel',      emoji: '🍬', desc: 'Fairy-type softies', bg: 'oklch(90% 0.08 90)',  ink: 'oklch(38% 0.08 90)' },
  { id: 'trainers',    label: 'Trainers',    emoji: '🃏', desc: 'Supporters & items', bg: 'oklch(88% 0.07 60)',  ink: 'oklch(35% 0.08 60)' },
  { id: 'fullart',     label: 'Full Art',    emoji: '🎨', desc: 'Rare art showcase',  bg: 'oklch(85% 0.09 320)', ink: 'oklch(32% 0.10 320)' },
]

// ── Design tokens
const T = {
  bg0:          '#0a0613',
  bgCard:       'rgba(40, 25, 70, 0.55)',
  bgCardStrong: 'rgba(50, 32, 88, 0.85)',
  border:       'rgba(168, 130, 255, 0.14)',
  borderStrong: 'rgba(168, 130, 255, 0.28)',
  ink0:         '#f4eeff',
  ink1:         '#cdc1e6',
  ink2:         '#8d82a8',
  ink3:         '#5b5072',
  brand:        'oklch(72% 0.19 305)',
  brandSoft:    'oklch(80% 0.12 305)',
  brandGlow:    'oklch(72% 0.19 305 / 0.35)',
  gold:         'oklch(82% 0.13 85)',
  fontDisplay:  '"Instrument Serif", "Playfair Display", Georgia, serif',
  fontSans:     '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
  fontMono:     '"Geist Mono", ui-monospace, monospace',
}

const PAGE_BG = `
  radial-gradient(ellipse 60% 50% at 20% 0%,  rgba(122,60,220,0.35), transparent 60%),
  radial-gradient(ellipse 50% 40% at 90% 100%, rgba(220,80,200,0.18),  transparent 60%),
  radial-gradient(ellipse 80% 60% at 50% 50%,  rgba(20,12,40,0.6),     transparent 70%),
  #0a0613
`

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ name = '', size = 32, ring = false }) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `oklch(65% 0.15 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: 'white',
      ...(ring ? { outline: `2px solid ${T.brandSoft}`, outlineOffset: 2 } : {}),
    }}>
      {name.charAt(0).toUpperCase() || '?'}
    </div>
  )
}

function Chip({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '5px 11px', borderRadius: 999, fontSize: 12,
      border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.03)', color: T.ink1,
    }}>{children}</span>
  )
}

function SectionHeader({ kicker, title, onRight, rightLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px 14px' }}>
      <div>
        <div style={{ fontSize: 10, color: T.ink2, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>{kicker}</div>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 26, color: T.ink0, lineHeight: 1 }}>{title}</div>
      </div>
      {rightLabel && (
        <button onClick={onRight} style={{ background: 'none', border: 'none', color: T.ink2, fontSize: 12, cursor: 'pointer', fontFamily: T.fontSans }}>
          {rightLabel} →
        </button>
      )}
    </div>
  )
}

function VibeTile({ vibe, compact = false, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onClick?.(vibe.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 16, padding: compact ? 14 : 18,
        background: vibe.bg, color: vibe.ink,
        cursor: 'pointer', border: 'none',
        minHeight: compact ? 92 : 110,
        width: compact ? 150 : '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 12px 30px rgba(0,0,0,0.4)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        fontFamily: T.fontSans, textAlign: 'left',
      }}
    >
      <div style={{ fontSize: compact ? 18 : 22 }}>{vibe.emoji}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: compact ? 14 : 16, marginBottom: 2 }}>{vibe.label}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{vibe.desc}</div>
      </div>
    </button>
  )
}

function BottomNav({ onNavigate }) {
  const items = [
    { id: 'home',     label: 'Home',    icon: '⌂' },
    { id: 'all',      label: 'Browse',  icon: '▤' },
    { id: 'wishlist', label: 'Library', icon: '⊞' },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(10,6,19,0.92)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${T.border}`,
      padding: '10px 20px 20px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => onNavigate(it.id)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: it.id === 'home' ? T.brandSoft : T.ink2,
          fontSize: 10, cursor: 'pointer', flex: 1,
          background: 'none', border: 'none', fontFamily: T.fontSans,
        }}>
          <span style={{ fontSize: 18 }}>{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

function SideItem({ icon, label, count, active, dot, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 8, fontSize: 13,
      color: active ? T.ink0 : T.ink1,
      background: active ? T.bgCardStrong : 'transparent',
      cursor: 'pointer', marginBottom: 2,
      border: 'none', width: '100%', textAlign: 'left', fontFamily: T.fontSans,
    }}>
      {dot
        ? <span style={{ width: 12, height: 12, borderRadius: 4, background: dot, display: 'inline-block', flexShrink: 0 }} />
        : <span style={{ width: 16, textAlign: 'center' }}>{icon}</span>
      }
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: T.ink3, fontFamily: T.fontMono }}>{count}</span>}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient headline em
// ─────────────────────────────────────────────────────────────────────────────
function GradientEm({ children }) {
  return (
    <em style={{
      fontStyle: 'italic',
      background: `linear-gradient(135deg, ${T.brandSoft}, ${T.gold})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent', color: 'transparent',
    }}>{children}</em>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Featured spotlight (shared between mobile + desktop)
// ─────────────────────────────────────────────────────────────────────────────
function FeaturedSpotlight({ card, idx, total, onDotClick, cardHeight = 180, desktop = false }) {
  return (
    <div style={{
      padding: desktop ? 28 : 18,
      borderRadius: desktop ? 24 : 28,
      background: 'linear-gradient(155deg, rgba(60,40,110,0.7), rgba(30,18,60,0.85))',
      border: `1px solid ${T.borderStrong}`,
      position: 'relative', overflow: 'hidden',
      ...(desktop ? { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' } : {}),
    }}>
      {/* Animated glow */}
      <div style={{
        position: 'absolute', inset: desktop ? 0 : -40,
        background: `radial-gradient(circle at ${desktop ? '30% 50%' : '50% 30%'}, oklch(70% 0.18 ${(card.hue ?? idx * 90) % 360} / 0.4), transparent 60%)`,
        transition: 'background 1.2s ease', pointerEvents: 'none',
      }} />

      {/* Card image */}
      <div style={{ position: 'relative', flexShrink: 0, ...(!desktop ? { display: 'flex', gap: 16, alignItems: 'center' } : {}) }}>
        <img
          src={card.image}
          alt={card.name}
          style={{
            height: cardHeight, width: 'auto', borderRadius: 12,
            boxShadow: '0 12px 28px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'transform 0.3s cubic-bezier(0.2,0.8,0.2,1)',
            display: 'block',
          }}
          onError={e => { e.currentTarget.style.opacity = '0' }}
        />

        {/* Card info — inline on mobile */}
        {!desktop && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.brandSoft, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{card.subtitle}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, lineHeight: 1.05, marginBottom: 8, color: T.ink0 }}>{card.name}</div>
            <div style={{ fontSize: 12, color: T.ink1, lineHeight: 1.4, marginBottom: 12, fontStyle: 'italic', fontFamily: T.fontDisplay }}>"{card.tagline}"</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip>{card.set}</Chip>
              <Chip>{card.rarity}</Chip>
            </div>
          </div>
        )}
      </div>

      {/* Card info — separate column on desktop */}
      {desktop && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: T.brandSoft, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>{card.subtitle}</div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 48, lineHeight: 1, marginBottom: 12, color: T.ink0 }}>{card.name}</div>
          <div style={{ fontSize: 16, color: T.ink1, maxWidth: 460, lineHeight: 1.5, marginBottom: 20, fontFamily: T.fontDisplay, fontStyle: 'italic' }}>"{card.tagline}"</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            <Chip>{card.set}</Chip>
            <Chip>{card.rarity}</Chip>
          </div>
        </div>
      )}

      {/* Pagination dots — below everything on mobile, not shown on desktop (arrow nav instead) */}
      {!desktop && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => onDotClick(i)} style={{
              width: i === idx ? 18 : 5, height: 5, borderRadius: 999,
              background: i === idx ? T.brandSoft : 'rgba(255,255,255,0.2)',
              border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePageEditorial({ user, profile, collectionIds, ownedIds, onNavigate }) {
  const [featuredIdx, setFeaturedIdx] = useState(0)

  const totalCards    = collectionIds?.size ?? 0
  const ownedCards    = ownedIds?.size      ?? 0
  const wishlistCards = totalCards - ownedCards
  const username      = profile?.username ?? user?.email?.split('@')[0] ?? 'collector'
  const today         = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    const t = setInterval(() => setFeaturedIdx(i => (i + 1) % FEATURED_CARDS.length), 5000)
    return () => clearInterval(t)
  }, [])

  const F = FEATURED_CARDS[featuredIdx]

  function handleSurpriseMe() {
    const pick = VIBES[Math.floor(Math.random() * VIBES.length)]
    onNavigate(pick.id)
  }

  // ── Shared page background style
  const pageBg = { minHeight: '100vh', background: PAGE_BG, fontFamily: T.fontSans, color: T.ink0 }

  // ─────────────────────────────────────────────────────────────────────────
  // Mobile layout  (< 1100px)
  // ─────────────────────────────────────────────────────────────────────────
  const mobile = (
    <div style={{ ...pageBg, paddingBottom: 90 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={username} size={32} ring />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>collector</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>@{username}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0 }}>Poképop ✦</div>
        )}
        <button
          onClick={() => onNavigate('all')}
          style={{
            width: 38, height: 38, borderRadius: 999,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
            color: T.ink0, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >🔍</button>
      </div>

      {/* Editorial headline */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>{today}</div>
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 40, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 0.95, color: T.ink0 }}>
          {user ? 'Welcome back,' : 'Discover your'}<br />
          <GradientEm>{user ? `${username}.` : 'vibe.'}</GradientEm>
        </h1>
        {user && (
          <div style={{ fontSize: 13, color: T.ink1, marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong style={{ color: T.ink0 }}>{totalCards}</strong> <span style={{ color: T.ink2 }}>saved</span></span>
            <span style={{ color: T.ink3 }}>·</span>
            <span><strong style={{ color: T.ink0 }}>{ownedCards}</strong> <span style={{ color: T.ink2 }}>owned</span></span>
            <span style={{ color: T.ink3 }}>·</span>
            <span><strong style={{ color: T.ink0 }}>{wishlistCards}</strong> <span style={{ color: T.ink2 }}>on wishlist</span></span>
          </div>
        )}
      </div>

      {/* Featured spotlight */}
      <div style={{ padding: '0 20px 32px' }}>
        <FeaturedSpotlight
          card={F}
          idx={featuredIdx}
          total={FEATURED_CARDS.length}
          onDotClick={setFeaturedIdx}
          cardHeight={180}
        />
      </div>

      {/* Browse by vibe */}
      <SectionHeader kicker="Browse the catalog" title="By vibe" />
      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {VIBES.slice(0, 4).map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 32px', scrollbarWidth: 'none' }}>
        {VIBES.slice(4).map(v => <VibeTile key={v.id} vibe={v} compact onClick={onNavigate} />)}
      </div>

      {/* My Collection shortcut (logged in only) */}
      {user && (
        <div style={{ padding: '0 20px 16px' }}>
          <button
            onClick={() => onNavigate('wishlist')}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.bgCardStrong, border: `1px solid ${T.border}`,
              color: T.ink0, cursor: 'pointer', fontFamily: T.fontSans,
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>My Collection</div>
              <div style={{ fontSize: 12, color: T.ink2 }}>{totalCards} cards · {ownedCards} owned</div>
            </div>
            <span style={{ fontSize: 20 }}>⊞</span>
          </button>
        </div>
      )}

      {/* Surprise me */}
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={handleSurpriseMe}
          style={{
            width: '100%', padding: 18, borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, oklch(50% 0.15 305), oklch(45% 0.18 340))',
            border: `1px solid ${T.borderStrong}`,
            color: 'white', cursor: 'pointer', fontFamily: T.fontSans,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Surprise me</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Random vibe · 18,000+ cards</div>
          </div>
          <span style={{ fontSize: 22 }}>⚄</span>
        </button>
      </div>

      <BottomNav onNavigate={onNavigate} />
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Desktop layout  (≥ 1100px)
  // ─────────────────────────────────────────────────────────────────────────
  const desktop = (
    <div style={{
      ...pageBg,
      display: 'grid',
      gridTemplateColumns: '220px 1fr 300px',
      gridTemplateRows: '60px 1fr',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Top bar — spans all 3 columns */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(10,6,19,0.6)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {/* Logo — keep the Poképop brand in display serif */}
          <button
            onClick={() => onNavigate('home')}
            style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            Poképop <span style={{ fontSize: 14, opacity: 0.6 }}>✦</span>
          </button>
          <nav style={{ display: 'flex', gap: 22, fontSize: 13 }}>
            <span style={{ color: T.ink0, fontWeight: 600 }}>Home</span>
            <button onClick={() => onNavigate('all')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Browse</button>
            <button onClick={() => onNavigate('wishlist', 'collection')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>My library</button>
            <button onClick={() => onNavigate('wishlist', 'wishlist')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Wishlist</button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => onNavigate('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 999, padding: '6px 14px', width: 280,
              color: T.ink2, fontSize: 13, cursor: 'pointer', fontFamily: T.fontSans,
            }}
          >
            <span>🔍</span>
            <span>Search 18,000+ cards…</span>
          </button>
          {user && <Avatar name={username} size={32} ring />}
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{
        borderRight: `1px solid ${T.border}`,
        padding: '20px 14px',
        background: 'rgba(10,6,19,0.4)',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 10px 8px' }}>Library</div>
        <SideItem icon="⊞" label="All cards" count={totalCards || undefined} active onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem icon="✓" label="Owned"     count={ownedCards || undefined}    onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem icon="♥" label="Wishlist"  count={wishlistCards || undefined}  onClick={() => onNavigate('wishlist', 'wishlist')} />
        <div style={{ height: 1, background: T.border, margin: '16px 10px' }} />
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 10px 8px' }}>Vibes</div>
        {VIBES.slice(0, 6).map(v => (
          <SideItem key={v.id} icon={v.emoji} label={v.label} dot={v.bg} onClick={() => onNavigate(v.id)} />
        ))}
      </aside>

      {/* Main column */}
      <main style={{ overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>{today}</div>
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 56, margin: '0 0 28px', lineHeight: 0.95, letterSpacing: '-0.02em', color: T.ink0 }}>
          Welcome back, <GradientEm>{username}.</GradientEm>
        </h1>

        {/* Featured hero */}
        <div style={{ marginBottom: 32 }}>
          <FeaturedSpotlight
            card={F}
            idx={featuredIdx}
            total={FEATURED_CARDS.length}
            onDotClick={setFeaturedIdx}
            cardHeight={260}
            desktop
          />
          {/* Desktop dot nav below hero */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 12 }}>
            {FEATURED_CARDS.map((_, i) => (
              <button key={i} onClick={() => setFeaturedIdx(i)} style={{
                width: i === featuredIdx ? 18 : 5, height: 5, borderRadius: 999,
                background: i === featuredIdx ? T.brandSoft : 'rgba(255,255,255,0.2)',
                border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Browse by vibe */}
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 28, margin: '0 0 14px', color: T.ink0, fontWeight: 400 }}>Browse by vibe</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
          {VIBES.map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
        </div>

        {/* Surprise me */}
        <button
          onClick={handleSurpriseMe}
          style={{
            width: '100%', padding: '18px 24px', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, oklch(50% 0.15 305), oklch(45% 0.18 340))',
            border: `1px solid ${T.borderStrong}`,
            color: 'white', cursor: 'pointer', fontFamily: T.fontSans, marginBottom: 32,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Surprise me</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Random vibe · 18,000+ cards</div>
          </div>
          <span style={{ fontSize: 22 }}>⚄</span>
        </button>
      </main>

      {/* Right rail */}
      <aside style={{
        borderLeft: `1px solid ${T.border}`,
        padding: '20px 18px',
        background: 'rgba(10,6,19,0.4)',
        overflowY: 'auto',
      }}>
        {/* Stats */}
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
            background: 'oklch(75% 0.20 25)', boxShadow: '0 0 8px oklch(75% 0.20 25)',
          }} />
          Your collection
        </div>

        {user ? (
          <>
            <button onClick={() => onNavigate('wishlist', 'collection')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 0', borderBottom: `1px solid ${T.border}`, background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.fontSans, paddingTop: 10, paddingBottom: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.ink0, fontFamily: T.fontMono }}>{totalCards}</div>
              <div style={{ fontSize: 11, color: T.ink2 }}>cards saved</div>
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
              <button onClick={() => onNavigate('wishlist', 'collection')} style={{ background: 'rgba(40,25,70,0.5)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: T.fontSans }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.brandSoft, fontFamily: T.fontMono }}>{ownedCards}</div>
                <div style={{ fontSize: 11, color: T.ink2 }}>owned</div>
              </button>
              <button onClick={() => onNavigate('wishlist', 'wishlist')} style={{ background: 'rgba(40,25,70,0.5)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: T.fontSans }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(78% 0.16 0)', fontFamily: T.fontMono }}>{wishlistCards}</div>
                <div style={{ fontSize: 11, color: T.ink2 }}>wishlist</div>
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.5, marginBottom: 16 }}>
            Sign in to track your collection and wishlist.
          </p>
        )}

        <div style={{ height: 1, background: T.border, margin: '8px 0 16px' }} />
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Quick vibes</div>
        {VIBES.slice(0, 5).map(v => (
          <button key={v.id} onClick={() => onNavigate(v.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '8px 10px', borderRadius: 8, marginBottom: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.ink1, fontSize: 13, fontFamily: T.fontSans, textAlign: 'left',
          }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: v.bg, display: 'inline-block', flexShrink: 0 }} />
            {v.label}
          </button>
        ))}

        <div style={{ height: 1, background: T.border, margin: '16px 0' }} />
        <button
          onClick={() => onNavigate('all')}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12,
            background: T.bgCardStrong, border: `1px solid ${T.borderStrong}`,
            color: T.ink0, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans,
            fontWeight: 600, textAlign: 'center',
          }}
        >
          Browse all 18,000+ cards →
        </button>
      </aside>
    </div>
  )

  return (
    <>
      {/* Editorial fonts — scoped to this view */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
      `}</style>
      <div className="pp-editorial-mobile">{mobile}</div>
      <div className="pp-editorial-desktop">{desktop}</div>
    </>
  )
}
