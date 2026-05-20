import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PackLogModal from './PackLogModal'
import ThemeToggle from './ThemeToggle'

// ── Daily Pokemon — deterministic per calendar day
const DAILY_POKEMON = [
  {
    name: 'Charizard', setId: 'base1', setName: 'Base Set', cardId: 'base1-4',
    image: 'https://images.pokemontcg.io/base1/4.png', rarity: 'Holo Rare', hue: 20,
    fact: 'The 1st Edition Base Set Charizard sold for $420,000 at auction in 2022 — the highest price ever paid for a Pokémon card.',
    showcase: ['base1-4', 'base1-2', 'base1-15'],
  },
  {
    name: 'Lugia', setId: 'neo1', setName: 'Neo Genesis', cardId: 'neo1-9',
    image: 'https://images.pokemontcg.io/neo1/9.png', rarity: 'Holo Rare', hue: 220,
    fact: 'Lugia was designed for the Pokémon movie before appearing in the games — one of the few Pokémon created for film first.',
    showcase: ['neo1-9', 'neo1-2', 'neo1-16'],
  },
  {
    name: 'Mew ex', setId: 'sv3pt5', setName: 'SV: 151', cardId: 'sv3pt5-205',
    image: 'https://images.pokemontcg.io/sv3pt5/205.png', rarity: 'Special Illustration Rare', hue: 305,
    fact: 'Mew is the only Pokémon that can learn every TM and HM — the Pokédex calls it the ancestor of all Pokémon.',
    showcase: ['sv3pt5-205', 'sv3pt5-232', 'sv3pt5-167'],
  },
  {
    name: 'Mewtwo', setId: 'base1', setName: 'Base Set', cardId: 'base1-10',
    image: 'https://images.pokemontcg.io/base1/10.png', rarity: 'Holo Rare', hue: 290,
    fact: 'Mewtwo had the highest HP of any Pokémon in the original Base Set — engineered from Mew\'s DNA and the ultimate collector\'s pursuit.',
    showcase: ['base1-10', 'base1-4', 'base1-2'],
  },
  {
    name: 'Gengar', setId: 'base3', setName: 'Fossil', cardId: 'base3-5',
    image: 'https://images.pokemontcg.io/base3/5.png', rarity: 'Holo Rare', hue: 275,
    fact: 'The Fossil Set Gengar is beloved for its eerie art — depicted emerging from shadows, it perfectly captures Gengar\'s ghostly nature.',
    showcase: ['base3-5', 'base3-1', 'base3-6'],
  },
  {
    name: 'Pikachu', setId: 'base1', setName: 'Base Set', cardId: 'base1-58',
    image: 'https://images.pokemontcg.io/base1/58.png', rarity: 'Common', hue: 60,
    fact: 'Despite being the franchise mascot, the Base Set Pikachu is a Common card. The "yellow cheeks" vs "red cheeks" print variant debate is legendary among collectors.',
    showcase: ['base1-58', 'base1-4', 'base1-10'],
  },
  {
    name: 'Blastoise', setId: 'base1', setName: 'Base Set', cardId: 'base1-2',
    image: 'https://images.pokemontcg.io/base1/2.png', rarity: 'Holo Rare', hue: 210,
    fact: 'Blastoise was chosen for the original Base Set booster box alongside Chansey — its twin water cannons made it an instant collector icon.',
    showcase: ['base1-2', 'base1-4', 'base1-15'],
  },
  {
    name: 'Venusaur', setId: 'base1', setName: 'Base Set', cardId: 'base1-15',
    image: 'https://images.pokemontcg.io/base1/15.png', rarity: 'Holo Rare', hue: 130,
    fact: 'Completing the Base Set holy trio — Charizard, Blastoise, and Venusaur — was every collector\'s first major milestone back in 1999.',
    showcase: ['base1-15', 'base1-4', 'base1-2'],
  },
  {
    name: 'Umbreon', setId: 'neo2', setName: 'Neo Discovery', cardId: 'neo2-13',
    image: 'https://images.pokemontcg.io/neo2/13.png', rarity: 'Holo Rare', hue: 250,
    fact: 'Umbreon evolves from Eevee with high friendship at night — a poetic constraint that made players genuinely bond with their Eevee before evolving it.',
    showcase: ['neo2-13', 'neo2-5', 'neo2-7'],
  },
  {
    name: 'Ho-Oh', setId: 'neo3', setName: 'Neo Revelation', cardId: 'neo3-7',
    image: 'https://images.pokemontcg.io/neo3/7.png', rarity: 'Holo Rare', hue: 15,
    fact: 'Ho-Oh appears in the very first episode of the Pokémon anime — years before the games revealed it was a legendary Pokémon.',
    showcase: ['neo3-7', 'neo3-6', 'neo3-14'],
  },
  {
    name: 'Articuno', setId: 'sv3pt5', setName: 'SV: 151', cardId: 'sv3pt5-144',
    image: 'https://images.pokemontcg.io/sv3pt5/144.png', rarity: 'Holo Rare', hue: 200,
    fact: 'Articuno is said to appear before those lost in icy mountains — legend says its wings are made of ice that never melts.',
    showcase: ['sv3pt5-144', 'base3-1', 'neo3-14'],
  },
  {
    name: 'Jolteon', setId: 'base2', setName: 'Jungle', cardId: 'base2-4',
    image: 'https://images.pokemontcg.io/base2/4.png', rarity: 'Holo Rare', hue: 60,
    fact: 'Jolteon can fire 10,000-volt electric bolts — its cells generate electricity charged to extreme power when it experiences strong emotions.',
    showcase: ['base2-4', 'base2-3', 'base2-12'],
  },
  {
    name: 'Eevee', setId: 'base2', setName: 'Jungle', cardId: 'base2-51',
    image: 'https://images.pokemontcg.io/base2/51.png', rarity: 'Common', hue: 35,
    fact: 'Eevee has the most evolutionary forms of any Pokémon — eight distinct evolutions based on item, environment, time of day, or friendship.',
    showcase: ['base2-51', 'base2-4', 'base2-3'],
  },
  {
    name: 'Dragonite', setId: 'base3', setName: 'Fossil', cardId: 'base3-4',
    image: 'https://images.pokemontcg.io/base3/4.png', rarity: 'Holo Rare', hue: 35,
    fact: 'Dragonite can circle the globe in just 16 hours — it guides lost ships and planes to safety, earning the nickname "Sea Incarnate."',
    showcase: ['base3-4', 'base3-5', 'base3-1'],
  },
]

// Pick today's Pokemon deterministically by day of year
function getDailyPokemon() {
  const start = new Date('2025-01-01')
  const day   = Math.floor((Date.now() - start.getTime()) / 86400000)
  return DAILY_POKEMON[Math.abs(day) % DAILY_POKEMON.length]
}

// ── Vibes — matches existing vibe IDs
// cardImg: national-dex numbers in sv3pt5 (Pokémon 151 set, cards 1-151 = national dex, 207 total)
const VIBES = [
  { id: 'girlypop',    label: 'Girlypop',    ball: 'love-ball',    desc: 'Cute & soft',        bg: 'oklch(82% 0.10 0)',   ink: 'oklch(35% 0.10 0)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/35.png' },   // Clefairy #35
  { id: 'space',       label: 'Space',       ball: 'moon-ball',    desc: 'Cosmic & celestial', bg: 'oklch(78% 0.09 240)', ink: 'oklch(30% 0.09 240)',
    cardImg: 'https://images.pokemontcg.io/neo1/9.png' },       // Lugia (Neo Genesis)
  { id: 'darkfairy',   label: 'Dark Fairy',  ball: 'dream-ball',   desc: 'Mysterious vibes',   bg: 'oklch(72% 0.10 290)', ink: 'oklch(98% 0.02 290)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/94.png' },    // Gengar #94
  { id: 'cottagecore', label: 'Cottagecore', ball: 'nest-ball',    desc: 'Cozy & botanical',   bg: 'oklch(85% 0.10 145)', ink: 'oklch(32% 0.10 145)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/133.png' },   // Eevee #133
  { id: 'nature',      label: 'Nature',      ball: 'safari-ball',  desc: 'Grass-type gallery', bg: 'oklch(80% 0.13 130)', ink: 'oklch(28% 0.10 130)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/3.png' },     // Venusaur #3
  { id: 'pastel',      label: 'Pastel',      ball: 'heal-ball',    desc: 'Fairy-type softies', bg: 'oklch(90% 0.08 90)',  ink: 'oklch(38% 0.08 90)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/39.png' },    // Jigglypuff #39
  { id: 'trainers',    label: 'Trainers',    icon: 'pokedex',      desc: 'Supporters & items', bg: 'oklch(88% 0.07 60)',  ink: 'oklch(35% 0.08 60)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/163.png' },   // Giovanni's Charisma (trainer in 151)
  { id: 'fullart',       label: 'Full Art',        icon: 'candy',        desc: 'Rare art showcase',   bg: 'oklch(85% 0.09 320)', ink: 'oklch(32% 0.10 320)',
    cardImg: 'https://images.pokemontcg.io/sv3pt5/182.png' },   // Illustration rare (within 207 total)
  { id: 'dragons',       label: 'Dragons',         icon: 'dragon',       desc: 'Dragon-type legends',  bg: 'oklch(82% 0.13 55)',  ink: 'oklch(30% 0.10 55)',
    cardImg: 'https://images.pokemontcg.io/base3/4.png' },            // Dragonite (Fossil)
  { id: 'megaevolution', label: 'Mega Evolution',  icon: 'mega',         desc: 'All 4 ME sets',        bg: 'oklch(82% 0.12 40)',  ink: 'oklch(32% 0.12 40)',
    cardImg: 'https://images.pokemontcg.io/me1/60.png' },             // Mega Gardevoir ex
]

// ── Inline SVG icons for Trainers + Full Art ────────────────────────────────
function PokedexIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="1" width="20" height="20" rx="4" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5"/>
      <circle cx="7" cy="8" r="3" fill={color} fillOpacity="0.6"/>
      <line x1="12" y1="7" x2="19" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="10" x2="17" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="3" y="14" width="16" height="5" rx="2" fill={color} fillOpacity="0.25"/>
    </svg>
  )
}

function RareCandyIcon({ color }) {
  // Wrapped candy: round body with diagonal stripes + twisted wrapper ends on left/right
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.5"/>
      {/* Diagonal stripe highlights inside candy */}
      <line x1="6" y1="15" x2="15" y2="6" stroke="white" strokeWidth="2" strokeOpacity="0.35" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="17" y2="8" stroke="white" strokeWidth="1.2" strokeOpacity="0.2" strokeLinecap="round"/>
      {/* Wrapper twist — left */}
      <path d="M4 11 Q 2 9 1.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M4 11 Q 2 13 1.5 15.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Wrapper twist — right */}
      <path d="M18 11 Q 20 9 20.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M18 11 Q 20 13 20.5 15.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function MegaIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <text x="11" y="16" textAnchor="middle" fontSize="15" fontWeight="900" fontFamily="Arial, sans-serif" fill={color} fillOpacity="0.85">M</text>
      <circle cx="11" cy="11" r="9.5" stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="0.5"/>
    </svg>
  )
}

function DragonIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {/* Wing left */}
      <path d="M3 14 Q1 8 5 5 Q7 10 6 14Z" fill={color} fillOpacity="0.5"/>
      {/* Wing right */}
      <path d="M19 14 Q21 8 17 5 Q15 10 16 14Z" fill={color} fillOpacity="0.5"/>
      {/* Body */}
      <ellipse cx="11" cy="13" rx="5" ry="6" fill={color} fillOpacity="0.7"/>
      {/* Head */}
      <circle cx="11" cy="8" r="3.5" fill={color} fillOpacity="0.85"/>
      {/* Eyes */}
      <circle cx="9.5" cy="7.5" r="0.9" fill="white" fillOpacity="0.9"/>
      <circle cx="12.5" cy="7.5" r="0.9" fill="white" fillOpacity="0.9"/>
      {/* Horn */}
      <path d="M10 5.5 L10.5 3.5 L11.5 5.5" fill={color}/>
    </svg>
  )
}

// ── Derive image URL from TCG card ID (e.g. "base1-4" → ".../base1/4.png")
function cardIdToImg(cardId) {
  if (!cardId) return ''
  const dash = cardId.lastIndexOf('-')
  if (dash === -1) return ''
  const setId = cardId.slice(0, dash)
  const num   = cardId.slice(dash + 1)
  return `https://images.pokemontcg.io/${setId}/${num}.png`
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

function Chip({ T, children, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 11px', borderRadius: 999, fontSize: 12,
        border: `1px solid ${T.border}`,
        background: 'rgba(128,128,128,0.08)',
        color: T.ink1,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'background 0.15s, color 0.15s' : undefined,
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.background = T.brand; e.currentTarget.style.color = 'white' } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.background = 'rgba(128,128,128,0.08)'; e.currentTarget.style.color = T.ink1 } : undefined}
    >{children}</span>
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

function VibeBall({ vibe, size = 22 }) {
  if (vibe.ball) {
    return (
      <span
        className={`theme-ball ${vibe.ball}`}
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <span className="theme-ball__top" />
        <span className="theme-ball__band" />
        <span className="theme-ball__button" />
        <span className="theme-ball__mark" />
      </span>
    )
  }
  if (vibe.icon === 'pokedex') return <PokedexIcon color={vibe.ink} />
  if (vibe.icon === 'candy')   return <RareCandyIcon color={vibe.ink} />
  if (vibe.icon === 'mega')    return <MegaIcon color={vibe.ink} />
  if (vibe.icon === 'dragon')  return <DragonIcon color={vibe.ink} />
  return null
}

function VibeTile({ vibe, compact = false, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onClick?.(vibe.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 16, padding: compact ? '13px 12px' : 18,
        background: vibe.bg, color: vibe.ink,
        cursor: 'pointer', border: 'none',
        minHeight: compact ? 104 : 110,
        width: '100%',
        minWidth: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 12px 30px rgba(0,0,0,0.25)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        fontFamily: 'inherit', textAlign: 'left',
      }}
    >
      <VibeBall vibe={vibe} size={compact ? 18 : 22} />
      {/* Text block — sits above gradient shield */}
      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: compact ? 13 : (vibe.label.length > 9 ? 13 : 16), lineHeight: compact ? 1.08 : 1.15, marginBottom: 3, overflowWrap: 'anywhere' }}>{vibe.label}</div>
        <div style={{ fontSize: compact ? 10.5 : 11, lineHeight: 1.2, opacity: 0.7, overflowWrap: 'anywhere' }}>{vibe.desc}</div>
      </div>
      {/* Card peek — decorative, clipped to tile */}
      {!compact && vibe.cardImg && (
        <>
          {/* Gradient shield: fades from tile bg on the left so text stays legible */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, borderRadius: 'inherit', pointerEvents: 'none',
            background: `linear-gradient(to right, ${vibe.bg} 35%, ${vibe.bg}99 58%, transparent 80%)`,
          }} />
          <img
            src={vibe.cardImg}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute', right: -10, bottom: -8,
              height: 95, width: 'auto', borderRadius: 6,
              transform: hov ? 'rotate(4deg) translateY(-4px)' : 'rotate(8deg)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              transition: 'transform 0.2s',
              pointerEvents: 'none', zIndex: 0,
            }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </>
      )}
    </button>
  )
}

function BottomNav({ T, user, onNavigate, onRequestSignIn }) {
  const items = [
    { id: 'home',     label: 'Home',    icon: '⌂',  authRequired: false },
    { id: 'all',      label: 'Browse',  icon: '▤',  authRequired: false },
    { id: 'scanner',  label: 'Scanner', icon: '▣',  authRequired: false },
    { id: 'wishlist', label: 'Library', icon: '⊞',  authRequired: true  },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: T.navBg,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${T.border}`,
      padding: '10px 20px',
      paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {items.map(it => (
        <button key={it.id} onClick={() => {
          if (it.authRequired && !user) { onRequestSignIn?.(); return }
          onNavigate(it.id)
        }} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          color: it.id === 'home' ? T.brand : T.ink2,
          fontSize: 10, lineHeight: 1, cursor: 'pointer', flex: 1,
          background: 'none', border: 'none', fontFamily: T.fontSans,
        }}>
          <span style={{
            width: 22,
            height: 22,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            lineHeight: 1,
            fontWeight: it.id === 'scanner' ? 800 : 400,
          }}>{it.icon}</span>
          <span style={{ lineHeight: 1.1 }}>{it.label}</span>
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
      background: `linear-gradient(135deg, ${T.brandSoft}, ${T.brand})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: T.brand, // fallback for browsers that don't support background-clip:text
    }}>{children}</em>
  )
}

// ── Pokéball that changes with light/dark mode (mirrors the card index logo)
function PokeBall({ isDark, size = '0.75em' }) {
  const ballClass = isDark ? 'luxury-ball' : 'love-ball'
  const mark      = isDark ? 'L' : '♥'
  return (
    <span
      className={`theme-ball ${ballClass}`}
      style={{ width: size, height: size, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      <span className="theme-ball__top" />
      <span className="theme-ball__band" />
      <span className="theme-ball__button" />
      <span className="theme-ball__mark">{mark}</span>
    </span>
  )
}

// ── Daily hero — single Pokemon per day with fun fact + set tag + showcase cards
function DailyHero({ T, pokemon, cardImage, isDark, onSetClick, onCardClick, onBrowsePokemon, desktop = false, showcaseCards = [] }) {
  const [imgFailed, setImgFailed] = useState(false)

  // Reset failure state when the daily pokemon or its resolved image changes
  useEffect(() => { setImgFailed(false) }, [pokemon.cardId, cardImage])

  // cardImage is fetched from Supabase (our ground truth) — never a raw .png CDN URL
  const resolvedImage = cardImage ?? pokemon.image

  const mainCardData = {
    cardId:    pokemon.cardId,
    cardName:  pokemon.name,
    cardImage: resolvedImage,
  }

  return (
    <div style={{
      padding: desktop ? 28 : 18,
      borderRadius: desktop ? 24 : 28,
      background: T.spotlightBg,
      border: `1px solid ${T.borderStrong}`,
      position: 'relative', overflow: 'hidden',
      ...(desktop ? { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' } : {}),
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: desktop ? 0 : -40,
        background: `radial-gradient(circle at ${desktop ? '30% 50%' : '50% 30%'}, oklch(70% 0.18 ${pokemon.hue} / 0.25), transparent 60%)`,
        pointerEvents: 'none',
      }} />

      {/* Card image — clickable on both mobile and desktop */}
      <div style={{ position: 'relative', flexShrink: 0, ...(!desktop ? { display: 'flex', gap: 16, alignItems: 'flex-start' } : {}) }}>
        <button
          onClick={() => onCardClick(mainCardData)}
          style={{
            border: 'none', background: 'none', padding: 0, cursor: 'pointer',
            borderRadius: 12, flexShrink: 0,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
          title={`View ${pokemon.name} details`}
        >
          {imgFailed ? (
            <div style={{
              height: desktop ? 280 : 180,
              width: desktop ? 200 : 130,
              borderRadius: 12,
              background: `oklch(65% 0.15 ${pokemon.hue} / 0.18)`,
              border: `2px dashed oklch(65% 0.15 ${pokemon.hue} / 0.35)`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              color: T.ink2, fontSize: 11,
            }}>
              <span style={{ fontSize: 32 }}>🃏</span>
              <span>{pokemon.name}</span>
            </div>
          ) : (
            <img
              src={resolvedImage}
              alt={pokemon.name}
              style={{
                height: desktop ? 280 : 180, width: 'auto', borderRadius: 12,
                boxShadow: '0 12px 28px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)',
                display: 'block',
              }}
              onError={() => setImgFailed(true)}
            />
          )}
        </button>

        {/* Mobile: text beside image */}
        {!desktop && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.brand, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>
              Today's card
            </div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, lineHeight: 1.05, marginBottom: 8, color: T.ink0 }}>
              {pokemon.name}
            </div>
            <div style={{ fontSize: 12, color: T.ink1, lineHeight: 1.5, marginBottom: 10, fontFamily: T.fontSans }}>
              {pokemon.fact}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip T={T} onClick={() => onSetClick(pokemon.setId)}>{pokemon.setName} →</Chip>
              <Chip T={T} onClick={() => onBrowsePokemon(pokemon.name)}>Browse {pokemon.name}s →</Chip>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: text + showcase cards (alternate printings) */}
      {desktop && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: T.brand, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
            Today's card
          </div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 48, lineHeight: 1, marginBottom: 10, color: T.ink0 }}>
            {pokemon.name}
          </div>
          <div style={{ fontSize: 15, color: T.ink1, maxWidth: 460, lineHeight: 1.6, marginBottom: 18, fontFamily: T.fontSans }}>
            {pokemon.fact}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            <Chip T={T} onClick={() => onSetClick(pokemon.setId)}>{pokemon.setName} →</Chip>
            <Chip T={T} onClick={() => onBrowsePokemon(pokemon.name)}>Browse {pokemon.name}s →</Chip>
          </div>

          {/* Alternate printings — fetched from TCG API, all same Pokemon */}
          {showcaseCards.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: T.ink3, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Other printings
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                {showcaseCards.map(card => (
                  <button
                    key={card.cardId}
                    onClick={() => onCardClick(card)}
                    style={{
                      border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                      borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'transform 0.18s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                    title={`${card.cardName} — ${card.setName}`}
                  >
                    <img
                      src={card.cardImage}
                      alt={card.cardName}
                      style={{ height: 88, width: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                    {card.setName && (
                      <span style={{ fontSize: 9, color: T.ink3, textAlign: 'center', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {card.setName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Full card detail modal — opens when user clicks a card
function FriendCardModal({ T, card, user, collectionIds, onClose, isDark }) {
  const [saving,    setSaving]    = useState(null)
  const [saved,     setSaved]     = useState(null)
  const alreadyInList = collectionIds?.has(card.cardId)

  async function addToOwn(owned) {
    if (!user || saving) return
    const label = owned ? 'collection' : 'wishlist'
    setSaving(label)
    await supabase.from('wishlists').upsert({
      user_id:  user.id,
      card_id:  card.cardId,
      name:     card.cardName,
      image:    card.cardImage,
      owned,
      edition:  'unspecified',
      language: 'english',
    }, { onConflict: 'user_id,card_id,edition,language' })
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

        <img
          src={card.cardImage || cardIdToImg(card.cardId)}
          alt={card.cardName}
          style={{ width: '100%', borderRadius: 16, marginBottom: 16, display: 'block', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          onError={e => { e.currentTarget.style.opacity = '0.3' }}
        />

        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, color: T.ink0, margin: '0 0 4px', fontWeight: 400 }}>
          {card.cardName}
        </h2>

        {card.action && (
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
        )}
        {!card.action && <p style={{ fontSize: 12, color: T.ink2, margin: '0 0 16px' }}>Featured today</p>}

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

// ── Friend activity row
function ActivityItem({ T, item, isOpen, onToggle, onOpenCard }) {
  const [showHits, setShowHits] = useState(false)

  // ── Pack-open activity item
  if (item.type === 'pack') {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '9px 0',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <Avatar T={T} name={item.username} size={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: T.ink1 }}>
              <a
                href={`/share/${item.userId}`}
                style={{ fontWeight: 600, color: T.ink0, textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.color = T.brand; e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.color = T.ink0; e.currentTarget.style.textDecoration = 'none' }}
              >
                {item.username}
              </a>
              {' opened '}
              <span style={{ fontWeight: 600, color: T.ink0 }}>{item.packName}</span>
              {item.hasHit && (
                <>
                  {' '}
                  <button
                    onClick={() => setShowHits(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: '#f59e0b', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit',
                    }}
                  >and got a HIT 🔥</button>
                </>
              )}
            </div>
            <div style={{ fontSize: 10, color: T.ink3, marginTop: 2 }}>🎴 pack opened · {item.time}</div>
          </div>
        </div>

        {/* Hit cards modal */}
        {showHits && (
          <div
            onClick={() => setShowHits(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9100,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: T.bgCard, borderRadius: 20, padding: '24px 24px 20px',
                maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink0, fontFamily: T.fontSans }}>
                  🔥 {item.username}'s hits from {item.packName}
                </div>
                <button
                  onClick={() => setShowHits(false)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.ink2, lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {(item.hitCards ?? []).map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setShowHits(false)
                      onOpenCard({ cardId: c.id ?? c.card_id, cardName: c.name, cardImage: c.image })
                    }}
                    style={{
                      textAlign: 'center', maxWidth: 110, background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer',
                    }}
                  >
                    {c.image && (
                      <img
                        src={c.image}
                        alt={c.name}
                        style={{ width: 90, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'transform 0.15s', display: 'block' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.ink0, marginTop: 5, fontFamily: T.fontSans }}>
                      {c.name ?? c.card_id ?? '—'}
                    </div>
                    {(c.market_price || c.mid_price) && (
                      <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>
                        ${(c.market_price || c.mid_price).toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
                {(!item.hitCards || item.hitCards.length === 0) && (
                  <div style={{ color: T.ink2, fontSize: 13, padding: '12px 0' }}>No hit details available.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Card collection/wishlist activity item
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

      {isOpen && (
        <div
          style={{
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
// Mini sign-in prompt — shown when guest clicks Library or collection links
// ─────────────────────────────────────────────────────────────────────────────
function MiniAuthModal({ T, isDark, onClose }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fn = isSignUp
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password })
    const { error: err } = await fn
    setLoading(false)
    if (err) { setError(err.message); return }
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: T.bgCard, borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <PokeBall isDark={isDark} size="36px" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.ink0, marginBottom: 4 }}>
            {isSignUp ? 'Create account' : 'Log in to track your collection'}
          </div>
          <div style={{ fontSize: 13, color: T.ink2 }}>
            {isSignUp ? 'Pick an email and password to get started' : 'Sign in with your email and password'}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required autoFocus
            style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${T.border}`,
              background: T.bgCardStrong, color: T.ink0, fontSize: 14, outline: 'none', fontFamily: T.fontSans }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${T.border}`,
              background: T.bgCardStrong, color: T.ink0, fontSize: 14, outline: 'none', fontFamily: T.fontSans }}
          />
          {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ padding: '11px', borderRadius: 12, background: 'linear-gradient(135deg, #f9a8d4, #c084fc)',
              color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 4 }}
          >
            {loading ? '…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={() => setIsSignUp(p => !p)}
          style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 12,
            fontSize: 12, color: T.ink2, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePageEditorial({ user, profile, profileReady = false, collectionIds, ownedIds, onNavigate, onNavigateToSearch, isDark = false, themeMode, onThemeToggle, onCardAdded }) {
  const [recentCards,    setRecentCards]    = useState([])
  const [friendActivity, setFriendActivity] = useState([])
  const [sharedCards,    setSharedCards]    = useState([])
  const [previewItemId,  setPreviewItemId]  = useState(null)
  const [selectedCard,   setSelectedCard]   = useState(null)
  const [showMiniAuth,   setShowMiniAuth]   = useState(false)
  const [packModalOpen,  setPackModalOpen]  = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [showcaseCards,  setShowcaseCards]  = useState([]) // alternate printings of the daily Pokemon
  const T = getTokens(isDark)

  const dailyPokemon  = getDailyPokemon()

  // Verified image URL for the daily card — loaded from our DB so we never show a card-back
  // (pokemontcg.io returns HTTP 200 + card-back image for missing .png, so onError never fires)
  const [dailyCardImage, setDailyCardImage] = useState(dailyPokemon.image)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('tcg_cards')
      .select('image_small, jp_image_small')
      .eq('id', dailyPokemon.cardId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const img = data?.image_small ?? data?.jp_image_small
        if (img) setDailyCardImage(img)
        // else keep the non-hires fallback already set
      })
    return () => { cancelled = true }
  }, [dailyPokemon.cardId])
  const totalCards    = collectionIds?.size ?? 0
  const ownedCards    = ownedIds?.size      ?? 0
  // Only resolve the username once the profile fetch has completed to avoid
  // a flash where the email prefix renders briefly before the real username arrives.
  const username = profileReady
    ? (profile?.username ?? user?.email?.split('@')[0] ?? 'collector')
    : null
  const today         = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Fetch alternate printings of the daily Pokemon for the hero showcase
  useEffect(() => {
    let cancelled = false
    setShowcaseCards([])

    async function fetchShowcase() {
      try {
        const headers = {}
        if (import.meta.env.VITE_TCG_API_KEY) headers['X-Api-Key'] = import.meta.env.VITE_TCG_API_KEY
        // Search by exact name to get all printings of this Pokemon
        const res  = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(dailyPokemon.name)}"&pageSize=12&orderBy=-set.releaseDate`,
          { headers }
        )
        const json = await res.json()
        if (cancelled || !json.data?.length) return

        // Exclude the exact same card ID shown as the main hero; take up to 3 alternates
        const alternates = json.data
          .filter(c => c.id !== dailyPokemon.cardId)
          .slice(0, 3)
          .map(c => ({
            cardId:    c.id,
            cardName:  c.name,
            cardImage: c.images?.small ?? cardIdToImg(c.id),
            setName:   c.set?.name ?? '',
          }))

        if (!cancelled) setShowcaseCards(alternates)
      } catch {
        // silently fail — showcase is decorative
      }
    }

    fetchShowcase()
    return () => { cancelled = true }
  }, [dailyPokemon.cardId])

  // Fetch real friend activity
  useEffect(() => {
    if (!user) { setFriendActivity([]); setSharedCards([]); setLoadingFriends(false); return }
    let cancelled = false
    setLoadingFriends(true)

    async function fetchFriendData() {
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

      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', followingIds)

      const profileMap = Object.fromEntries((friendProfiles ?? []).map(p => [p.id, p]))

      // Fetch card activity and pack log activity in parallel
      const [{ data: activityRows }, { data: packRows }] = await Promise.all([
        supabase
          .from('wishlists')
          .select('card_id, name, image, owned, created_at, user_id')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('pack_logs')
          .select('id, user_id, pack_name, packs, opened_at, cards')
          .in('user_id', followingIds)
          .order('opened_at', { ascending: false })
          .limit(10),
      ])

      if (cancelled) return

      const cardItems = (activityRows ?? []).map(w => ({
        id:        `${w.user_id}-${w.card_id}-${w.created_at}`,
        type:      'card',
        userId:    w.user_id,
        username:  profileMap[w.user_id]?.username ?? 'unknown',
        action:    w.owned ? 'added to collection' : 'wishlisted',
        cardName:  w.name  ?? w.card_id,
        cardId:    w.card_id,
        cardImage: w.image ?? cardIdToImg(w.card_id),
        time:      timeAgo(w.created_at),
        sortTime:  w.created_at,
      }))

      const packItems = (packRows ?? []).map(log => ({
        id:       `pack-${log.id}`,
        type:     'pack',
        userId:   log.user_id,
        username: profileMap[log.user_id]?.username ?? 'unknown',
        packName: log.packs?.length > 0
          ? log.packs.map(p => p.name).filter(Boolean).join(' + ')
          : log.pack_name,
        hasHit:   (log.cards ?? []).some(c => (c.market_price || 0) >= 5),
        hitCards: (log.cards ?? []).filter(c => (c.market_price || 0) >= 5),
        time:     timeAgo(log.opened_at),
        sortTime: log.opened_at,
      }))

      const merged = [...cardItems, ...packItems]
        .sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime))
        .slice(0, 25)

      setFriendActivity(merged)

      const { data: allFriendCards } = await supabase
        .from('wishlists')
        .select('card_id, name, image, user_id')
        .in('user_id', followingIds)
        .limit(500)

      if (cancelled) return

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

  // Fetch 3 most recently added cards
  useEffect(() => {
    if (!user) { setRecentCards([]); return }
    let cancelled = false

    async function fetchRecent() {
      const { data, error } = await supabase
        .from('wishlists')
        .select('card_id, owned, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)

      if (error || cancelled || !data?.length) return

      // Batch-fetch card metadata from Supabase (handles Japanese cards correctly)
      const cardIds = data.map(r => r.card_id)
      const { data: tcgRows } = await supabase
        .from('tcg_cards')
        .select('id, name, set_name, image_small, jp_image_small, card_language')
        .in('id', cardIds)
      const cardMap = Object.fromEntries((tcgRows ?? []).map(c => [c.id, c]))

      const cards = data.map(({ card_id, owned }) => {
        const tc  = cardMap[card_id]
        const img = tc?.image_small ?? tc?.jp_image_small ?? cardIdToImg(card_id)
        return {
          id:    card_id,
          name:  tc?.name    ?? card_id,
          set:   tc?.set_name ?? '',
          image: img,
          owned,
        }
      })

      if (!cancelled) setRecentCards(cards)
    }

    fetchRecent()
    return () => { cancelled = true }
  }, [user?.id])

  function handleSurpriseMe() {
    onNavigate(VIBES[Math.floor(Math.random() * VIBES.length)].id)
  }

  function togglePreview(id) {
    setPreviewItemId(prev => prev === id ? null : id)
  }

  function handleSetClick(setId) {
    onNavigate('all', 'collection', setId)
  }

  function handleBrowsePokemon(name) {
    onNavigate('all', 'collection', null, name)
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
    <div style={{ ...pageBase, paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Top bar — Pokepop branding + search */}
      <div style={{ padding: '16px 20px 12px', textAlign: 'center' }}>
        {/* Logo — always shown, same as card index */}
        <button
          onClick={() => onNavigate('home')}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 4,
          }}
        >
          <span className="theme-heading" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
            Poképop
          </span>
          <PokeBall isDark={isDark} size="30px" />
        </button>
        <p style={{ fontSize: 12, color: T.ink2, marginBottom: 14, fontWeight: 500 }}>
          Discover Pokémon cards by vibe ✨
        </p>

        {/* Full-width search bar */}
        <button
          onClick={() => (onNavigateToSearch ?? onNavigate)('all')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: T.bgCardStrong, border: `1px solid ${T.border}`,
            borderRadius: 999, padding: '11px 16px',
            color: T.ink2, fontSize: 14, cursor: 'pointer',
            fontFamily: T.fontSans, textAlign: 'left',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontSize: 15 }}>🔍</span>
          <span>Search 18,000+ cards…</span>
        </button>
      </div>

      {/* Editorial headline */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 11, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>{today}</div>
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 40, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1.1, color: T.ink0 }}>
          {user
            ? username
              ? <><span style={{ color: T.ink0 }}>Welcome back,</span><br /><GradientEm T={T}>{username}.</GradientEm></>
              : <GradientEm T={T}>Welcome back!</GradientEm>
            : <GradientEm T={T}>Welcome!</GradientEm>
          }
        </h1>
      </div>

      {/* Daily hero */}
      <div style={{ padding: '0 20px 32px' }}>
        <DailyHero T={T} pokemon={dailyPokemon} cardImage={dailyCardImage} isDark={isDark} onSetClick={handleSetClick} onCardClick={setSelectedCard} onBrowsePokemon={handleBrowsePokemon} />
      </div>

      {/* Quick actions — above Browse by Vibe */}
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!user && (
          <button
            onClick={() => setShowMiniAuth(true)}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.bgCard, border: `1px solid ${T.border}`,
              color: T.ink0, cursor: 'pointer', fontFamily: T.fontSans,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Log in</div>
              <div style={{ fontSize: 12, color: T.ink2 }}>Track your collection & wishlist</div>
            </div>
            <span style={{ fontSize: 20 }}>→</span>
          </button>
        )}

        <button
          onClick={handleSurpriseMe}
          style={{
            width: '100%', padding: '16px 20px', borderRadius: 20,
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

        {user && (
          <button
            onClick={() => setPackModalOpen(true)}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: isDark
                ? 'linear-gradient(135deg, oklch(45% 0.15 180), oklch(40% 0.12 210))'
                : 'linear-gradient(135deg, #a7f3d0, #6ee7b7)',
              border: `1px solid ${T.borderStrong}`,
              color: isDark ? '#d1fae5' : '#065f46', cursor: 'pointer', fontFamily: T.fontSans,
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Log a pack</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Track what you pulled</div>
            </div>
            <span style={{ fontSize: 22 }}>🎴</span>
          </button>
        )}
      </div>

      {/* Browse by vibe */}
      <SectionHeader T={T} kicker="Browse the catalog" title="By vibe" />
      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {VIBES.slice(0, 4).map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, padding: '0 20px 32px' }}>
        {VIBES.slice(4).map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
      </div>

      {/* Ko-fi support tile — mobile, centered */}
      <div style={{ padding: '0 20px 28px', display: 'flex', justifyContent: 'center' }}>
        <a
          href="https://ko-fi.com/qakirap"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 22px', borderRadius: 20,
            background: isDark
              ? 'linear-gradient(135deg, oklch(35% 0.08 30), oklch(30% 0.06 30))'
              : 'linear-gradient(135deg, #fff7ed, #ffedd5)',
            border: `1px solid ${isDark ? 'rgba(251,146,60,0.25)' : 'rgba(251,146,60,0.35)'}`,
            textDecoration: 'none', width: '100%', maxWidth: 340,
            boxShadow: '0 2px 12px rgba(251,146,60,0.12)',
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>☕</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#fdba74' : '#c2410c', lineHeight: 1.2 }}>
              Support on Ko-fi
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#9a3412', opacity: 0.8, marginTop: 2 }}>
              Help keep Poképop free & growing
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: isDark ? '#fdba74' : '#c2410c', flexShrink: 0 }}>→</span>
        </a>
      </div>

      {/* Social feed — below vibe catalog on mobile */}
      <div style={{ padding: '0 20px 32px' }}>
        <SectionHeader T={T} kicker="Friends & trainers" title="Social feed" />
        {loadingFriends && (
          <div style={{ fontSize: 12, color: T.ink3, padding: '8px 0' }}>Loading…</div>
        )}
        {!loadingFriends && !user && (
          <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.5, padding: '8px 0' }}>
            Sign in to see what your friends are collecting.
          </div>
        )}
        {!loadingFriends && user && friendActivity.length === 0 && (
          <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6, padding: '8px 0' }}>
            No activity yet. Follow other trainers to see their collection updates here.
          </div>
        )}
        {friendActivity.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {friendActivity.slice(0, 8).map(item => (
              <ActivityItem
                key={item.id}
                T={T}
                item={item}
                isOpen={previewItemId === item.id}
                onToggle={() => setPreviewItemId(p => p === item.id ? null : item.id)}
                onOpenCard={setSelectedCard}
              />
            ))}
          </div>
        )}
      </div>

      {/* Theme toggle — above bottom nav on mobile, respects iPhone safe-area */}
      {onThemeToggle && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          left: 16,
          zIndex: 50,
        }}>
          <ThemeToggle
            mode={themeMode}
            onToggle={onThemeToggle}
            className="shadow-lg backdrop-blur-md"
          />
        </div>
      )}
      <BottomNav T={T} user={user} onNavigate={onNavigate} onRequestSignIn={() => setShowMiniAuth(true)} />
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Desktop layout  (≥ 1100px)
  // ─────────────────────────────────────────────────────────────────────────
  const desktop = (
    <div style={{
      ...pageBase,
      display: 'grid',
      gridTemplateColumns: '280px 1fr 380px',
      gridTemplateRows: '60px 1fr',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: '280px 1fr 380px',
        alignItems: 'center',
        borderBottom: `1px solid ${T.border}`,
        background: T.navBg,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        {/* Left — branding only (aligns with left sidebar) */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
          <button
            onClick={() => onNavigate('home')}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
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
          </button>
        </div>

        {/* Center — search bar (aligns exactly with main content column) */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
          <button
            onClick={() => (onNavigateToSearch ?? onNavigate)('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 999, padding: '7px 16px', width: '100%', maxWidth: 480,
              color: T.ink2, fontSize: 13, cursor: 'pointer', fontFamily: T.fontSans,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <span>🔍</span>
            <span>Search 18,000+ cards…</span>
          </button>
        </div>

        {/* Right — nav links + avatar (aligns with right rail) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18, paddingRight: 24 }}>
          <nav style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span style={{ color: T.brand, fontWeight: 600 }}>Home</span>
            <button onClick={() => onNavigate('all')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Browse</button>
            <button onClick={() => onNavigate('wishlist', 'collection')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>My Collection</button>
            <button onClick={() => onNavigate('wishlist', 'binder')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>My Binder</button>
          </nav>
          {user && username && <Avatar T={T} name={username} size={32} ring />}
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
        <div style={{ height: 1, background: T.border, margin: '4px 10px 16px' }} />

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
              style={{ height: 60, width: 'auto', borderRadius: 6, flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.28)' }}
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
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 56, margin: '0 0 28px', lineHeight: 1.05, letterSpacing: '-0.02em', color: T.ink0 }}>
          {user
            ? username
              ? <>Welcome back, <GradientEm T={T}>{username}.</GradientEm></>
              : <GradientEm T={T}>Welcome back!</GradientEm>
            : <GradientEm T={T}>Welcome!</GradientEm>
          }
        </h1>

        {/* Daily hero */}
        <div style={{ marginBottom: 32 }}>
          <DailyHero T={T} pokemon={dailyPokemon} isDark={isDark} onSetClick={handleSetClick} onCardClick={setSelectedCard} onBrowsePokemon={handleBrowsePokemon} desktop showcaseCards={showcaseCards} />
        </div>

        {/* Surprise me + Log a Pack — above vibe grid */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <button
            onClick={handleSurpriseMe}
            style={{
              flex: 1, padding: '18px 24px', borderRadius: 18,
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
          {user ? (
            <button
              onClick={() => setPackModalOpen(true)}
              style={{
                flex: 1, padding: '18px 24px', borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: isDark
                  ? 'linear-gradient(135deg, oklch(45% 0.15 180), oklch(40% 0.12 210))'
                  : 'linear-gradient(135deg, #a7f3d0, #6ee7b7)',
                border: `1px solid ${T.borderStrong}`,
                color: isDark ? '#d1fae5' : '#065f46', cursor: 'pointer', fontFamily: T.fontSans,
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Log a pack</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Track what you pulled</div>
              </div>
              <span style={{ fontSize: 22 }}>🎴</span>
            </button>
          ) : (
            <button
              onClick={() => setShowMiniAuth(true)}
              style={{
                flex: 1, padding: '18px 24px', borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: T.bgCard, border: `1px solid ${T.border}`,
                color: T.ink0, cursor: 'pointer', fontFamily: T.fontSans,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Log in</div>
                <div style={{ fontSize: 12, color: T.ink2 }}>Track your collection</div>
              </div>
              <span style={{ fontSize: 22 }}>→</span>
            </button>
          )}
        </div>

        {/* Browse by vibe */}
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 28, margin: '0 0 14px', color: T.ink0, fontWeight: 400 }}>Browse by vibe</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
          {VIBES.map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
        </div>

        {/* Ko-fi support tile — desktop */}
        <a
          href="https://ko-fi.com/qakirap"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 24px', borderRadius: 20,
            background: isDark
              ? 'linear-gradient(135deg, oklch(35% 0.08 30), oklch(30% 0.06 30))'
              : 'linear-gradient(135deg, #fff7ed, #ffedd5)',
            border: `1px solid ${isDark ? 'rgba(251,146,60,0.25)' : 'rgba(251,146,60,0.35)'}`,
            textDecoration: 'none',
            boxShadow: '0 2px 16px rgba(251,146,60,0.10)',
            transition: 'box-shadow 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(251,146,60,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 16px rgba(251,146,60,0.10)' }}
        >
          <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>☕</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#fdba74' : '#c2410c', lineHeight: 1.3 }}>
              Support on Ko-fi
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#9a3412', opacity: 0.8, marginTop: 3 }}>
              Help keep Poképop free & growing
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 16, color: isDark ? '#fdba74' : '#c2410c', flexShrink: 0 }}>→</span>
        </a>
      </main>

      {/* ── Right rail — Friend activity (top 50%) + Shared cards (bottom 50%) */}
      <aside style={{
        borderLeft: `1px solid ${T.border}`,
        background: T.sideBg,
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}>

        {/* TOP HALF: Friend activity feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 12px', minHeight: 0 }}>
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

        {/* Divider */}
        <div style={{ height: 1, background: T.borderStrong, flexShrink: 0 }} />

        {/* BOTTOM HALF: Cards multiple friends collect — equal height */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 20px', minHeight: 0 }}>
          <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
            Friends are collecting
          </div>

          {!loadingFriends && user && sharedCards.length === 0 && (
            <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6 }}>
              Cards collected by multiple friends will appear here.
            </div>
          )}

          {sharedCards.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {sharedCards.map(card => (
                  <SharedCard key={card.cardId} T={T} card={card} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.ink3, marginTop: 12, lineHeight: 1.4 }}>
                Badge = number of friends collecting this card.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )

  return (
    <>
      <div className="pp-editorial-mobile">{mobile}</div>
      <div className="pp-editorial-desktop">{desktop}</div>

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

      {packModalOpen && user && (
        <PackLogModal
          user={user}
          onClose={() => setPackModalOpen(false)}
          onSaved={() => {}}
          onCardsSaved={cards => cards.forEach(c => onCardAdded?.(c.id, true, 'english'))}
        />
      )}

      {showMiniAuth && !user && (
        <MiniAuthModal T={T} isDark={isDark} onClose={() => setShowMiniAuth(false)} />
      )}
    </>
  )
}
