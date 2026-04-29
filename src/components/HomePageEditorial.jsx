import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Featured card carousel
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
    image: 'https://images.pokemontcg.io/neo1/9_hires.png', // neo1 = Neo Genesis
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

// ── Vibes — matches existing vibe IDs
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

// ── Derive image URL from TCG card ID (e.g. "base1-4" → ".../base1/4_hires.png")
function cardIdToImg(cardId) {
  const dash = cardId.lastIndexOf('-')
  if (dash === -1) return ''
  const setId = cardId.slice(0, dash)
  const num   = cardId.slice(dash + 1)
  return `https://images.pokemontcg.io/${setId}/${num}_hires.png`
}

// ── Human-readable relative time
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Design tokens — theme-aware
function getTokens(isDark) {
  if (isDark) {
    return {
      pageBg:       'radial-gradient(circle at top, #3b1b63 0%, #24133b 38%, #151227 100%)',
      bgCard:       'rgba(40, 25, 70, 0.55)',
      bgCardStrong: 'rgba(50, 32, 88, 0.85)',
      border:       'rgba(192, 132, 252, 0.24)',
      borderStrong: 'rgba(168, 130, 255, 0.28)',
      ink0:         '#d6d0e6',
      ink1:         '#b8afd0',
      ink2:         '#8d82a8',
      ink3:         '#5b5072',
      brand:        '#c084fc',
      brandSoft:    '#f0abfc',
      gold:         'oklch(82% 0.13 85)',
      navBg:        'rgba(21, 18, 39, 0.92)',
      sideBg:       'rgba(21, 18, 39, 0.45)',
      spotlightBg:  'linear-gradient(155deg, rgba(60,40,110,0.7), rgba(30,18,60,0.85))',
      fontDisplay:  '"Instrument Serif", "Playfair Display", Georgia, serif',
      fontSans:     '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
      fontMono:     '"Geist Mono", ui-monospace, monospace',
    }
  }
  return {
    pageBg:       'linear-gradient(135deg, #FFD1DC 0%, #FFF0F5 50%, #B2E2F2 100%)',
    bgCard:       'rgba(255, 255, 255, 0.78)',
    bgCardStrong: 'rgba(255, 255, 255, 0.92)',
    border:       'rgba(244, 114, 182, 0.28)',
    borderStrong: 'rgba(244, 114, 182, 0.45)',
    ink0:         '#374151',
    ink1:         '#6b7280',
    ink2:         '#9ca3af',
    ink3:         '#d1d5db',
    brand:        '#ec4899',
    brandSoft:    '#f472b6',
    gold:         '#d97706',
    navBg:        'rgba(255, 255, 255, 0.88)',
    sideBg:       'rgba(255, 255, 255, 0.55)',
    spotlightBg:  'linear-gradient(155deg, rgba(255,209,220,0.75), rgba(255,240,245,0.85))',
    fontDisplay:  '"Instrument Serif", "Playfair Display", Georgia, serif',
    fontSans:     '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
    fontMono:     '"Geist Mono", ui-monospace, monospace',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ T, name = '', size = 32, ring = false }) {
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

function Chip({ T, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '5px 11px', borderRadius: 999, fontSize: 12,
      border: `1px solid ${T.border}`,
      background: 'rgba(128,128,128,0.08)',
      color: T.ink1,
    }}>{children}</span>
  )
}

function SectionHeader({ T, kicker, title, onRight, rightLabel }) {
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
        boxShadow: hov ? '0 12px 30px rgba(0,0,0,0.25)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        fontFamily: 'inherit', textAlign: 'left',
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

function BottomNav({ T, onNavigate }) {
  const items = [
    { id: 'home',     label: 'Home',    icon: '⌂' },
    { id: 'all',      label: 'Browse',  icon: '▤' },
    { id: 'wishlist', label: 'Library', icon: '⊞' },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: T.navBg,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${T.border}`,
      padding: '10px 20px 20px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => onNavigate(it.id)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: it.id === 'home' ? T.brand : T.ink2,
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

function SideItem({ T, icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 8, fontSize: 13,
      color: active ? T.ink0 : T.ink1,
      background: active ? T.bgCard : 'transparent',
      cursor: 'pointer', marginBottom: 2,
      border: active ? `1px solid ${T.border}` : '1px solid transparent',
      width: '100%', textAlign: 'left', fontFamily: T.fontSans,
    }}>
      <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: T.ink3, fontFamily: T.fontMono }}>{count}</span>}
    </button>
  )
}

function GradientEm({ T, children }) {
  return (
    <em style={{
      fontStyle: 'italic',
      background: `linear-gradient(135deg, ${T.brandSoft}, ${T.gold})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent', color: 'transparent',
    }}>{children}</em>
  )
}

function FeaturedSpotlight({ T, card, idx, total, onDotClick, cardHeight = 180, desktop = false }) {
  return (
    <div style={{
      padding: desktop ? 28 : 18,
      borderRadius: desktop ? 24 : 28,
      background: T.spotlightBg,
      border: `1px solid ${T.borderStrong}`,
      position: 'relative', overflow: 'hidden',
      ...(desktop ? { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' } : {}),
    }}>
      <div style={{
        position: 'absolute', inset: desktop ? 0 : -40,
        background: `radial-gradient(circle at ${desktop ? '30% 50%' : '50% 30%'}, oklch(70% 0.18 ${(card.hue ?? idx * 90) % 360} / 0.25), transparent 60%)`,
        transition: 'background 1.2s ease', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', flexShrink: 0, ...(!desktop ? { display: 'flex', gap: 16, alignItems: 'center' } : {}) }}>
        <img
          src={card.image}
          alt={card.name}
          style={{
            height: cardHeight, width: 'auto', borderRadius: 12,
            boxShadow: '0 12px 28px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)',
            transition: 'transform 0.3s cubic-bezier(0.2,0.8,0.2,1)',
            display: 'block',
          }}
          onError={e => { e.currentTarget.style.opacity = '0' }}
        />

        {!desktop && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.brand, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{card.subtitle}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, lineHeight: 1.05, marginBottom: 8, color: T.ink0 }}>{card.name}</div>
            <div style={{ fontSize: 12, color: T.ink1, lineHeight: 1.4, marginBottom: 12, fontStyle: 'italic', fontFamily: T.fontDisplay }}>"{card.tagline}"</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip T={T}>{card.set}</Chip>
              <Chip T={T}>{card.rarity}</Chip>
            </div>
          </div>
        )}
      </div>

      {desktop && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: T.brand, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 10 }}>{card.subtitle}</div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 48, lineHeight: 1, marginBottom: 12, color: T.ink0 }}>{card.name}</div>
          <div style={{ fontSize: 16, color: T.ink1, maxWidth: 460, lineHeight: 1.5, marginBottom: 20, fontFamily: T.fontDisplay, fontStyle: 'italic' }}>"{card.tagline}"</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            <Chip T={T}>{card.set}</Chip>
            <Chip T={T}>{card.rarity}</Chip>
          </div>
        </div>
      )}

      {!desktop && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => onDotClick(i)} style={{
              width: i === idx ? 18 : 5, height: 5, borderRadius: 999,
              background: i === idx ? T.brand : 'rgba(128,128,128,0.3)',
              border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Full card detail modal — opens when user clicks the inline card preview image
function FriendCardModal({ T, card, user, collectionIds, onClose, isDark }) {
  const [saving,    setSaving]    = useState(null) // 'wishlist' | 'collection' | null
  const [saved,     setSaved]     = useState(null) // 'wishlist' | 'collection' | null
  const alreadyInList = collectionIds?.has(card.cardId)

  async function addToOwn(owned) {
    if (!user || saving) return
    const label = owned ? 'collection' : 'wishlist'
    setSaving(label)
    await supabase.from('wishlists').upsert({
      user_id: user.id,
      card_id: card.cardId,
      name:    card.cardName,
      image:   card.cardImage,
      owned,
    }, { onConflict: 'user_id,card_id' })
    setSaving(null)
    setSaved(label)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: isDark ? 'rgba(10,6,25,0.82)' : 'rgba(255,209,220,0.78)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bgCardStrong,
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 24, padding: 24,
          maxWidth: 360, width: '100%',
          position: 'relative',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(128,128,128,0.15)', border: 'none',
            color: T.ink2, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        {/* Card image */}
        <img
          src={card.cardImage || cardIdToImg(card.cardId)}
          alt={card.cardName}
          style={{ width: '100%', borderRadius: 16, marginBottom: 16, display: 'block', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          onError={e => { e.currentTarget.style.opacity = '0.3' }}
        />

        {/* Name + context */}
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0, margin: '0 0 4px', fontWeight: 400 }}>
          {card.cardName}
        </h2>
        <p style={{ fontSize: 12, color: T.ink2, margin: '0 0 16px' }}>
          {card.action === 'added to collection' ? '📦' : '💖'}{' '}
          {card.action} by{' '}
          <a
            href={`/share/${card.userId}`}
            style={{ color: T.brand, fontWeight: 600, textDecoration: 'none' }}
          >
            {card.username}
          </a>
          {' · '}{card.time}
        </p>

        {/* Want / Have buttons */}
        {user && !alreadyInList && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => addToOwn(false)}
              disabled={!!saving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 13, fontWeight: 600,
                border: `1px solid ${T.border}`,
                background: saved === 'wishlist' ? T.brand : T.bgCard,
                color: saved === 'wishlist' ? 'white' : T.brand,
                cursor: saving ? 'default' : 'pointer', fontFamily: T.fontSans,
                opacity: saving && saving !== 'wishlist' ? 0.5 : 1,
              }}
            >
              {saved === 'wishlist' ? '💖 Saved!' : saving === 'wishlist' ? '…' : '💖 Want'}
            </button>
            <button
              onClick={() => addToOwn(true)}
              disabled={!!saving}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 14, fontSize: 13, fontWeight: 600,
                border: `1px solid ${T.border}`,
                background: saved === 'collection' ? T.brand : T.bgCard,
                color: saved === 'collection' ? 'white' : T.ink0,
                cursor: saving ? 'default' : 'pointer', fontFamily: T.fontSans,
                opacity: saving && saving !== 'collection' ? 0.5 : 1,
              }}
            >
              {saved === 'collection' ? '✅ Saved!' : saving === 'collection' ? '…' : '✅ Have'}
            </button>
          </div>
        )}
        {user && alreadyInList && (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: T.bgCard, border: `1px solid ${T.border}`, fontSize: 12, color: T.ink2, marginBottom: 12, textAlign: 'center' }}>
            Already in your collection ✓
          </div>
        )}

        {/* TCGPlayer link */}
        <a
          href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.cardName)}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', textAlign: 'center',
            padding: '10px 0', borderRadius: 14,
            background: T.brand, color: 'white',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            fontFamily: T.fontSans,
          }}
        >
          View on TCGPlayer →
        </a>
      </div>
    </div>
  )
}

// ── Friend activity row — card name expands inline thumbnail; clicking thumbnail opens full modal
function ActivityItem({ T, item, isOpen, onToggle, onOpenCard }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '9px 0',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Avatar T={T} name={item.username} size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, lineHeight: 1.4, color: T.ink1 }}>
            {/* Username → links to their public collection */}
            <a
              href={`/share/${item.userId}`}
              style={{ fontWeight: 600, color: T.ink0, textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.brand; e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.currentTarget.style.color = T.ink0; e.currentTarget.style.textDecoration = 'none' }}
            >
              {item.username}
            </a>
            {' '}
            <span style={{ color: item.action === 'wishlisted' ? T.brandSoft : T.ink2 }}>
              {item.action}
            </span>
            {' '}
            {/* Card name → toggle inline preview */}
            <button
              onClick={onToggle}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', color: T.brand, fontWeight: 600,
                fontSize: 12, fontFamily: T.fontSans,
                textDecoration: isOpen ? 'underline' : 'none',
              }}
            >
              {item.cardName}
            </button>
          </div>
          <div style={{ fontSize: 10, color: T.ink3, marginTop: 2 }}>{item.time}</div>
        </div>
      </div>

      {/* Inline thumbnail — clicking it opens the full card modal */}
      {isOpen && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 0 10px 32px',
          borderBottom: `1px solid ${T.border}`,
          background: T.bgCard,
          borderRadius: 10,
          margin: '2px 0',
          cursor: 'pointer',
        }}
          onClick={onOpenCard}
          title="Click to open card details"
        >
          <img
            src={item.cardImage || cardIdToImg(item.cardId)}
            alt={item.cardName}
            style={{
              height: 76, width: 'auto', borderRadius: 6, flexShrink: 0,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s',
            }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink0, marginBottom: 2 }}>{item.cardName}</div>
            <div style={{ fontSize: 11, color: T.ink2 }}>Tap to view details →</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small card tile for "friends are collecting" section
function SharedCard({ T, card }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', flexShrink: 0,
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.2s',
        cursor: 'default',
      }}
    >
      <img
        src={card.cardImage || cardIdToImg(card.cardId)}
        alt={card.cardName}
        style={{
          height: 90, width: 'auto', borderRadius: 8,
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          display: 'block',
        }}
        onError={e => { e.currentTarget.style.opacity = '0.3' }}
      />
      {/* Friend count badge */}
      <div style={{
        position: 'absolute', top: -6, right: -6,
        background: T.brand, color: 'white',
        fontSize: 9, fontWeight: 700,
        width: 18, height: 18, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono,
      }}>
        {card.friendCount}
      </div>
      {/* Card name tooltip on hover */}
      {hov && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)',
          background: T.bgCardStrong, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '4px 8px',
          fontSize: 10, color: T.ink0, whiteSpace: 'nowrap',
          marginBottom: 4, pointerEvents: 'none',
        }}>
          {card.cardName}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePageEditorial({ user, profile, collectionIds, ownedIds, onNavigate, onNavigateToSearch, isDark = false }) {
  const [featuredIdx,   setFeaturedIdx]   = useState(0)
  const [recentCards,   setRecentCards]   = useState([])   // last 3 wishlisted cards
  const [friendActivity, setFriendActivity] = useState([]) // recent additions by followed users
  const [sharedCards,   setSharedCards]   = useState([])   // cards owned by multiple friends
  const [previewItemId, setPreviewItemId] = useState(null) // which activity row shows inline thumbnail
  const [selectedCard,  setSelectedCard]  = useState(null) // card open in full modal
  const [loadingFriends, setLoadingFriends] = useState(true)
  const T = getTokens(isDark)

  const totalCards    = collectionIds?.size ?? 0
  const ownedCards    = ownedIds?.size      ?? 0
  const wishlistCards = totalCards - ownedCards
  const username      = profile?.username ?? user?.email?.split('@')[0] ?? 'collector'
  const today         = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Auto-rotate featured carousel
  useEffect(() => {
    const t = setInterval(() => setFeaturedIdx(i => (i + 1) % FEATURED_CARDS.length), 5000)
    return () => clearInterval(t)
  }, [])

  // Fetch real friend activity from follows + wishlists
  useEffect(() => {
    if (!user) { setFriendActivity([]); setSharedCards([]); setLoadingFriends(false); return }
    let cancelled = false
    setLoadingFriends(true)

    async function fetchFriendData() {
      // 1. Who does this user follow?
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      if (cancelled) return
      const followingIds = (followRows ?? []).map(f => f.following_id)

      if (!followingIds.length) {
        setFriendActivity([])
        setSharedCards([])
        setLoadingFriends(false)
        return
      }

      // 2. Fetch profiles for following list (for usernames)
      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', followingIds)

      const profileMap = Object.fromEntries((friendProfiles ?? []).map(p => [p.id, p]))

      // 3. Recent activity — 20 most recently added cards from followed users
      //    RLS ensures we only see cards from public profiles
      const { data: activityRows } = await supabase
        .from('wishlists')
        .select('card_id, name, image, owned, created_at, user_id')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(20)

      if (cancelled) return

      const formatted = (activityRows ?? []).map(w => ({
        id:        `${w.user_id}-${w.card_id}-${w.created_at}`,
        userId:    w.user_id,
        username:  profileMap[w.user_id]?.username ?? 'unknown',
        action:    w.owned ? 'added to collection' : 'wishlisted',
        cardName:  w.name  ?? w.card_id,
        cardId:    w.card_id,
        cardImage: w.image ?? cardIdToImg(w.card_id),
        time:      timeAgo(w.created_at),
      }))
      setFriendActivity(formatted)

      // 4. Shared cards — all friend wishlists to find overlaps
      //    Fetch up to 500 rows so we get a meaningful overlap count
      const { data: allFriendCards } = await supabase
        .from('wishlists')
        .select('card_id, name, image, user_id')
        .in('user_id', followingIds)
        .limit(500)

      if (cancelled) return

      // Group by card_id and count distinct owners
      const cardMap = {}
      for (const w of allFriendCards ?? []) {
        if (!cardMap[w.card_id]) {
          cardMap[w.card_id] = {
            cardId:    w.card_id,
            cardName:  w.name  ?? w.card_id,
            cardImage: w.image ?? cardIdToImg(w.card_id),
            ownerIds:  new Set(),
          }
        }
        cardMap[w.card_id].ownerIds.add(w.user_id)
      }

      const shared = Object.values(cardMap)
        .map(c => ({ cardId: c.cardId, cardName: c.cardName, cardImage: c.cardImage, friendCount: c.ownerIds.size }))
        .filter(c => c.friendCount > 1)
        .sort((a, b) => b.friendCount - a.friendCount)
        .slice(0, 6)

      if (!cancelled) {
        setSharedCards(shared)
        setLoadingFriends(false)
      }
    }

    fetchFriendData()
    return () => { cancelled = true }
  }, [user?.id])

  // Fetch the 3 most recently added cards as a proxy for "recently viewed"
  useEffect(() => {
    if (!user) { setRecentCards([]); return }
    let cancelled = false

    async function fetchRecent() {
      const { data, error } = await supabase
        .from('wishlists')
        .select('card_id, owned, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error || cancelled || !data?.length) return

      // Fetch card names + images from TCG API
      const cards = await Promise.all(
        data.map(async ({ card_id, owned }) => {
          const fallbackImg = cardIdToImg(card_id)
          try {
            const headers = {}
            if (import.meta.env.VITE_TCG_API_KEY) headers['X-Api-Key'] = import.meta.env.VITE_TCG_API_KEY
            const res  = await fetch(`https://api.pokemontcg.io/v2/cards/${card_id}`, { headers })
            const json = await res.json()
            const c    = json.data
            return {
              id:    card_id,
              name:  c?.name   ?? card_id,
              set:   c?.set?.name ?? '',
              image: c?.images?.small ?? fallbackImg,
              owned,
            }
          } catch {
            return { id: card_id, name: card_id, set: '', image: fallbackImg, owned }
          }
        })
      )

      if (!cancelled) setRecentCards(cards)
    }

    fetchRecent()
    return () => { cancelled = true }
  }, [user?.id])

  const F = FEATURED_CARDS[featuredIdx]

  function handleSurpriseMe() {
    onNavigate(VIBES[Math.floor(Math.random() * VIBES.length)].id)
  }

  function togglePreview(id) {
    setPreviewItemId(prev => prev === id ? null : id)
  }

  const pageBase = {
    minHeight: '100vh',
    background: T.pageBg,
    fontFamily: T.fontSans,
    color: T.ink0,
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mobile layout  (< 1100px)
  // ─────────────────────────────────────────────────────────────────────────
  const mobile = (
    <div style={{ ...pageBase, paddingBottom: 90 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar T={T} name={username} size={32} ring />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>collector</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink0 }}>@{username}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0 }}>Poképop ✦</div>
        )}
        <button
          onClick={() => (onNavigateToSearch ?? onNavigate)('all')}
          style={{
            width: 38, height: 38, borderRadius: 999,
            background: T.bgCard, border: `1px solid ${T.border}`,
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
          <GradientEm T={T}>{user ? `${username}.` : 'vibe.'}</GradientEm>
        </h1>
        {user && (
          <div style={{ fontSize: 13, color: T.ink1, marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <FeaturedSpotlight T={T} card={F} idx={featuredIdx} total={FEATURED_CARDS.length} onDotClick={setFeaturedIdx} cardHeight={180} />
      </div>

      {/* Browse by vibe */}
      <SectionHeader T={T} kicker="Browse the catalog" title="By vibe" />
      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {VIBES.slice(0, 4).map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 32px', scrollbarWidth: 'none' }}>
        {VIBES.slice(4).map(v => <VibeTile key={v.id} vibe={v} compact onClick={onNavigate} />)}
      </div>

      {/* My Collection shortcut */}
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
            background: isDark
              ? 'linear-gradient(135deg, oklch(50% 0.15 305), oklch(45% 0.18 340))'
              : 'linear-gradient(135deg, #f9a8d4, #c084fc)',
            border: `1px solid ${T.borderStrong}`,
            color: 'white', cursor: 'pointer', fontFamily: T.fontSans,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Surprise me</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Random vibe · 18,000+ cards</div>
          </div>
          <span style={{ fontSize: 22 }}>⚄</span>
        </button>
      </div>

      <BottomNav T={T} onNavigate={onNavigate} />
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Desktop layout  (≥ 1100px)
  // ─────────────────────────────────────────────────────────────────────────
  const desktop = (
    <div style={{
      ...pageBase,
      display: 'grid',
      gridTemplateColumns: '220px 1fr 300px',
      gridTemplateRows: '60px 1fr',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: `1px solid ${T.border}`,
        background: T.navBg,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <button
            onClick={() => onNavigate('home')}
            style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            Poképop <span style={{ fontSize: 14, opacity: 0.5 }}>✦</span>
          </button>
          <nav style={{ display: 'flex', gap: 22, fontSize: 13 }}>
            <span style={{ color: T.brand, fontWeight: 600 }}>Home</span>
            <button onClick={() => onNavigate('all')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Browse</button>
            <button onClick={() => onNavigate('wishlist', 'collection')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>My library</button>
            <button onClick={() => onNavigate('wishlist', 'wishlist')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Wishlist</button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => (onNavigateToSearch ?? onNavigate)('all')}
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
          {user && <Avatar T={T} name={username} size={32} ring />}
        </div>
      </div>

      {/* ── Left sidebar — Library + Recent cards */}
      <aside style={{
        borderRight: `1px solid ${T.border}`,
        padding: '20px 14px',
        background: T.sideBg,
        backdropFilter: 'blur(12px)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Library nav */}
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 10px 8px' }}>Library</div>
        <SideItem T={T} icon="⊞" label="All cards"  count={totalCards || undefined}   active onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem T={T} icon="✓" label="Owned"      count={ownedCards || undefined}    onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem T={T} icon="♥" label="Wishlist"   count={wishlistCards || undefined}  onClick={() => onNavigate('wishlist', 'wishlist')} />

        <div style={{ height: 1, background: T.border, margin: '16px 10px' }} />

        {/* Recent cards — last 3 added to their collection */}
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 10px 10px' }}>Recently added</div>
        {!user && (
          <div style={{ padding: '8px 10px', fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            Sign in to see your recent cards.
          </div>
        )}
        {user && recentCards.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
            Cards you add will appear here.
          </div>
        )}
        {recentCards.map(card => (
          <button
            key={card.id}
            onClick={() => onNavigate('wishlist', 'collection')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, marginBottom: 3,
              background: 'transparent', border: '1px solid transparent',
              cursor: 'pointer', textAlign: 'left', fontFamily: T.fontSans,
              width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.borderColor = T.border }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            <img
              src={card.image}
              alt={card.name}
              style={{ height: 44, width: 'auto', borderRadius: 5, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
              <div style={{ fontSize: 10, color: T.ink2 }}>{card.owned ? '✓ Owned' : '♥ Wishlist'}</div>
            </div>
          </button>
        ))}

        <div style={{ flex: 1 }} />
      </aside>

      {/* ── Main column */}
      <main style={{ overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>{today}</div>
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 56, margin: '0 0 28px', lineHeight: 0.95, letterSpacing: '-0.02em', color: T.ink0 }}>
          {user
            ? <>Welcome back, <GradientEm T={T}>{username}.</GradientEm></>
            : <>Discover your <GradientEm T={T}>vibe.</GradientEm></>
          }
        </h1>

        {/* Featured hero */}
        <div style={{ marginBottom: 32 }}>
          <FeaturedSpotlight T={T} card={F} idx={featuredIdx} total={FEATURED_CARDS.length} onDotClick={setFeaturedIdx} cardHeight={260} desktop />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 12 }}>
            {FEATURED_CARDS.map((_, i) => (
              <button key={i} onClick={() => setFeaturedIdx(i)} style={{
                width: i === featuredIdx ? 18 : 5, height: 5, borderRadius: 999,
                background: i === featuredIdx ? T.brand : 'rgba(128,128,128,0.3)',
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
            background: isDark
              ? 'linear-gradient(135deg, oklch(50% 0.15 305), oklch(45% 0.18 340))'
              : 'linear-gradient(135deg, #f9a8d4, #c084fc)',
            border: `1px solid ${T.borderStrong}`,
            color: 'white', cursor: 'pointer', fontFamily: T.fontSans, marginBottom: 32,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Surprise me</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Random vibe · 18,000+ cards</div>
          </div>
          <span style={{ fontSize: 22 }}>⚄</span>
        </button>
      </main>

      {/* ── Right rail — Friend activity (top) + Shared cards (bottom) */}
      <aside style={{
        borderLeft: `1px solid ${T.border}`,
        background: T.sideBg,
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── TOP HALF: Friend activity feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 12px' }}>
          <div style={{
            fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase',
            marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              background: isDark ? 'oklch(75% 0.20 25)' : '#ec4899',
              boxShadow: `0 0 8px ${isDark ? 'oklch(75% 0.20 25)' : '#ec4899'}`,
            }} />
            Friend activity
          </div>

          {loadingFriends && (
            <div style={{ fontSize: 12, color: T.ink3, padding: '12px 0' }}>Loading…</div>
          )}

          {!loadingFriends && !user && (
            <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.5, padding: '8px 0' }}>
              Sign in to see what your friends are collecting.
            </div>
          )}

          {!loadingFriends && user && friendActivity.length === 0 && (
            <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6, padding: '8px 0' }}>
              No activity yet.{' '}
              <span style={{ color: T.ink3 }}>
                Follow collectors with public profiles to see their recent adds here.
              </span>
            </div>
          )}

          {friendActivity.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: T.ink3, marginBottom: 10 }}>
                Tap a card name · then the image to open it
              </div>
              {friendActivity.map(item => (
                <ActivityItem
                  key={item.id}
                  T={T}
                  item={item}
                  isOpen={previewItemId === item.id}
                  onToggle={() => togglePreview(item.id)}
                  onOpenCard={() => setSelectedCard(item)}
                />
              ))}
            </>
          )}
        </div>

        {/* Divider — only shown when both sections have content */}
        {sharedCards.length > 0 && (
          <div style={{ height: 1, background: T.borderStrong, flexShrink: 0 }} />
        )}

        {/* ── BOTTOM HALF: Cards multiple friends collect */}
        {sharedCards.length > 0 && (
          <div style={{ padding: '14px 18px 20px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
              Friends are collecting
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {sharedCards.map(card => (
                <SharedCard key={card.cardId} T={T} card={card} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: T.ink3, marginTop: 12, lineHeight: 1.4 }}>
              Badge = number of friends collecting this card.
            </div>
          </div>
        )}
      </aside>
    </div>
  )

  return (
    <>
      <div className="pp-editorial-mobile">{mobile}</div>
      <div className="pp-editorial-desktop">{desktop}</div>

      {/* Full card detail modal — opens from friend activity card click */}
      {selectedCard && (
        <FriendCardModal
          T={T}
          card={selectedCard}
          user={user}
          collectionIds={collectionIds}
          onClose={() => setSelectedCard(null)}
          isDark={isDark}
        />
      )}
    </>
  )
}
