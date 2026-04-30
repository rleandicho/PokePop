import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Daily Pokemon — deterministic per calendar day
const DAILY_POKEMON = [
  {
    name: 'Charizard', setId: 'base1', setName: 'Base Set', cardId: 'base1-4',
    image: 'https://images.pokemontcg.io/base1/4_hires.png', rarity: 'Holo Rare', hue: 20,
    fact: 'The 1st Edition Base Set Charizard sold for $420,000 at auction in 2022 — the highest price ever paid for a Pokémon card.',
    showcase: ['base1-4', 'base1-2', 'base1-15'],
  },
  {
    name: 'Lugia', setId: 'neo1', setName: 'Neo Genesis', cardId: 'neo1-9',
    image: 'https://images.pokemontcg.io/neo1/9_hires.png', rarity: 'Holo Rare', hue: 220,
    fact: 'Lugia was designed for the Pokémon movie before appearing in the games — one of the few Pokémon created for film first.',
    showcase: ['neo1-9', 'neo1-2', 'neo1-16'],
  },
  {
    name: 'Mew ex', setId: 'sv3pt5', setName: 'SV: 151', cardId: 'sv3pt5-205',
    image: 'https://images.pokemontcg.io/sv3pt5/205_hires.png', rarity: 'Special Illustration Rare', hue: 305,
    fact: 'Mew is the only Pokémon that can learn every TM and HM — the Pokédex calls it the ancestor of all Pokémon.',
    showcase: ['sv3pt5-205', 'sv3pt5-232', 'sv3pt5-167'],
  },
  {
    name: 'Mewtwo', setId: 'base1', setName: 'Base Set', cardId: 'base1-10',
    image: 'https://images.pokemontcg.io/base1/10_hires.png', rarity: 'Holo Rare', hue: 290,
    fact: 'Mewtwo had the highest HP of any Pokémon in the original Base Set — engineered from Mew\'s DNA and the ultimate collector\'s pursuit.',
    showcase: ['base1-10', 'base1-4', 'base1-2'],
  },
  {
    name: 'Gengar', setId: 'fossil', setName: 'Fossil', cardId: 'fossil-5',
    image: 'https://images.pokemontcg.io/fossil/5_hires.png', rarity: 'Holo Rare', hue: 275,
    fact: 'The Fossil Set Gengar is beloved for its eerie art — depicted emerging from shadows, it perfectly captures Gengar\'s ghostly nature.',
    showcase: ['fossil-5', 'fossil-2', 'fossil-6'],
  },
  {
    name: 'Pikachu', setId: 'base1', setName: 'Base Set', cardId: 'base1-58',
    image: 'https://images.pokemontcg.io/base1/58_hires.png', rarity: 'Common', hue: 60,
    fact: 'Despite being the franchise mascot, the Base Set Pikachu is a Common card. The "yellow cheeks" vs "red cheeks" print variant debate is legendary among collectors.',
    showcase: ['base1-58', 'base1-4', 'base1-10'],
  },
  {
    name: 'Blastoise', setId: 'base1', setName: 'Base Set', cardId: 'base1-2',
    image: 'https://images.pokemontcg.io/base1/2_hires.png', rarity: 'Holo Rare', hue: 210,
    fact: 'Blastoise was chosen for the original Base Set booster box alongside Chansey — its twin water cannons made it an instant collector icon.',
    showcase: ['base1-2', 'base1-4', 'base1-15'],
  },
  {
    name: 'Venusaur', setId: 'base1', setName: 'Base Set', cardId: 'base1-15',
    image: 'https://images.pokemontcg.io/base1/15_hires.png', rarity: 'Holo Rare', hue: 130,
    fact: 'Completing the Base Set holy trio — Charizard, Blastoise, and Venusaur — was every collector\'s first major milestone back in 1999.',
    showcase: ['base1-15', 'base1-4', 'base1-2'],
  },
  {
    name: 'Umbreon', setId: 'neo2', setName: 'Neo Discovery', cardId: 'neo2-13',
    image: 'https://images.pokemontcg.io/neo2/13_hires.png', rarity: 'Holo Rare', hue: 250,
    fact: 'Umbreon evolves from Eevee with high friendship at night — a poetic constraint that made players genuinely bond with their Eevee before evolving it.',
    showcase: ['neo2-13', 'neo2-5', 'neo2-7'],
  },
  {
    name: 'Ho-Oh', setId: 'neo3', setName: 'Neo Revelation', cardId: 'neo3-7',
    image: 'https://images.pokemontcg.io/neo3/7_hires.png', rarity: 'Holo Rare', hue: 15,
    fact: 'Ho-Oh appears in the very first episode of the Pokémon anime — years before the games revealed it was a legendary Pokémon.',
    showcase: ['neo3-7', 'neo3-6', 'neo3-14'],
  },
  {
    name: 'Articuno', setId: 'fossil', setName: 'Fossil', cardId: 'fossil-17',
    image: 'https://images.pokemontcg.io/fossil/17_hires.png', rarity: 'Holo Rare', hue: 200,
    fact: 'Articuno is said to appear before those lost in icy mountains — legend says its wings are made of ice that never melts.',
    showcase: ['fossil-17', 'fossil-5', 'fossil-2'],
  },
  {
    name: 'Jolteon', setId: 'jungle', setName: 'Jungle', cardId: 'jungle-4',
    image: 'https://images.pokemontcg.io/jungle/4_hires.png', rarity: 'Holo Rare', hue: 60,
    fact: 'Jolteon can fire 10,000-volt electric bolts — its cells generate electricity charged to extreme power when it experiences strong emotions.',
    showcase: ['jungle-4', 'jungle-6', 'jungle-3'],
  },
  {
    name: 'Eevee', setId: 'jungle', setName: 'Jungle', cardId: 'jungle-51',
    image: 'https://images.pokemontcg.io/jungle/51_hires.png', rarity: 'Common', hue: 35,
    fact: 'Eevee has the most evolutionary forms of any Pokémon — eight distinct evolutions based on item, environment, time of day, or friendship.',
    showcase: ['jungle-51', 'jungle-4', 'jungle-6'],
  },
  {
    name: 'Dragonite', setId: 'fossil', setName: 'Fossil', cardId: 'fossil-4',
    image: 'https://images.pokemontcg.io/fossil/4_hires.png', rarity: 'Holo Rare', hue: 35,
    fact: 'Dragonite can circle the globe in just 16 hours — it guides lost ships and planes to safety, earning the nickname "Sea Incarnate."',
    showcase: ['fossil-4', 'fossil-5', 'fossil-2'],
  },
]

// Pick today's Pokemon deterministically by day of year
function getDailyPokemon() {
  const start = new Date('2025-01-01')
  const day   = Math.floor((Date.now() - start.getTime()) / 86400000)
  return DAILY_POKEMON[Math.abs(day) % DAILY_POKEMON.length]
}

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
function DailyHero({ T, pokemon, isDark, onSetClick, onCardClick, onBrowsePokemon, desktop = false, showcaseCards = [] }) {
  const mainCardData = {
    cardId:    pokemon.cardId,
    cardName:  pokemon.name,
    cardImage: pokemon.image,
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
          <img
            src={pokemon.image}
            alt={pokemon.name}
            style={{
              height: desktop ? 280 : 180, width: 'auto', borderRadius: 12,
              boxShadow: '0 12px 28px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)',
              display: 'block',
            }}
            onError={e => { e.currentTarget.style.opacity = '0' }}
          />
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
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePageEditorial({ user, profile, collectionIds, ownedIds, onNavigate, onNavigateToSearch, isDark = false }) {
  const [recentCards,    setRecentCards]    = useState([])
  const [friendActivity, setFriendActivity] = useState([])
  const [sharedCards,    setSharedCards]    = useState([])
  const [previewItemId,  setPreviewItemId]  = useState(null)
  const [selectedCard,   setSelectedCard]   = useState(null)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [showcaseCards,  setShowcaseCards]  = useState([]) // alternate printings of the daily Pokemon
  const T = getTokens(isDark)

  const dailyPokemon  = getDailyPokemon()
  const totalCards    = collectionIds?.size ?? 0
  const ownedCards    = ownedIds?.size      ?? 0
  const username      = profile?.username ?? user?.email?.split('@')[0] ?? 'collector'
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
        .limit(3)

      if (error || cancelled || !data?.length) return

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
    <div style={{ ...pageBase, paddingBottom: 90 }}>

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
          <PokeBall isDark={isDark} size="0.75em" />
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
        <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 400, fontSize: 40, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 0.95, color: T.ink0 }}>
          {user ? 'Welcome back,' : 'Discover your'}<br />
          <GradientEm T={T}>{user ? `${username}.` : 'vibe.'}</GradientEm>
        </h1>
      </div>

      {/* Daily hero */}
      <div style={{ padding: '0 20px 32px' }}>
        <DailyHero T={T} pokemon={dailyPokemon} isDark={isDark} onSetClick={handleSetClick} onCardClick={setSelectedCard} onBrowsePokemon={handleBrowsePokemon} />
      </div>

      {/* My Collection + Surprise Me — above Browse by Vibe */}
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {user && (
          <button
            onClick={() => onNavigate('wishlist')}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.bgCardStrong, border: `1px solid ${T.border}`,
              color: T.ink0, cursor: 'pointer', fontFamily: T.fontSans,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>My Collection</div>
              <div style={{ fontSize: 12, color: T.ink2 }}>{totalCards} cards · {ownedCards} owned</div>
            </div>
            <span style={{ fontSize: 22 }}>⊞</span>
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
      </div>

      {/* Browse by vibe */}
      <SectionHeader T={T} kicker="Browse the catalog" title="By vibe" />
      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {VIBES.slice(0, 4).map(v => <VibeTile key={v.id} vibe={v} onClick={onNavigate} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 32px', scrollbarWidth: 'none' }}>
        {VIBES.slice(4).map(v => <VibeTile key={v.id} vibe={v} compact onClick={onNavigate} />)}
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
      gridTemplateColumns: '280px 1fr 380px',
      gridTemplateRows: '60px 1fr',
      height: '100vh',
      overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 16,
        padding: '0 28px',
        borderBottom: `1px solid ${T.border}`,
        background: T.navBg,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        {/* Left — branding + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button
            onClick={() => onNavigate('home')}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span className="theme-heading" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Poképop
            </span>
            <span
              className={`theme-ball ${isDark ? 'luxury-ball' : 'love-ball'}`}
              style={{ width: 24, height: 24, flexShrink: 0 }}
            >
              <span className="theme-ball__top" />
              <span className="theme-ball__band" />
              <span className="theme-ball__button" />
              <span className="theme-ball__mark">{isDark ? 'L' : '♥'}</span>
            </span>
          </button>
          <nav style={{ display: 'flex', gap: 22, fontSize: 13 }}>
            <span style={{ color: T.brand, fontWeight: 600 }}>Home</span>
            <button onClick={() => onNavigate('all')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Browse</button>
            <button onClick={() => onNavigate('wishlist', 'collection')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>My library</button>
            <button onClick={() => onNavigate('wishlist', 'wishlist')} style={{ background: 'none', border: 'none', color: T.ink1, cursor: 'pointer', fontSize: 13, fontFamily: T.fontSans }}>Wishlist</button>
          </nav>
        </div>

        {/* Center — search bar */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => (onNavigateToSearch ?? onNavigate)('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 999, padding: '7px 16px', width: '100%', maxWidth: 380,
              color: T.ink2, fontSize: 13, cursor: 'pointer', fontFamily: T.fontSans,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <span>🔍</span>
            <span>Search 18,000+ cards…</span>
          </button>
        </div>

        {/* Right — avatar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
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
        <div style={{ fontSize: 10, color: T.ink2, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0 10px 8px' }}>Library</div>
        <SideItem T={T} icon="⊞" label="All cards"  count={totalCards || undefined}   active onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem T={T} icon="✓" label="Owned"      count={ownedCards || undefined}    onClick={() => onNavigate('wishlist', 'collection')} />
        <SideItem T={T} icon="♥" label="Wishlist"   count={(totalCards - ownedCards) || undefined}  onClick={() => onNavigate('wishlist', 'wishlist')} />

        <div style={{ height: 1, background: T.border, margin: '16px 10px' }} />

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

        {/* Daily hero */}
        <div style={{ marginBottom: 32 }}>
          <DailyHero T={T} pokemon={dailyPokemon} isDark={isDark} onSetClick={handleSetClick} onCardClick={setSelectedCard} onBrowsePokemon={handleBrowsePokemon} desktop showcaseCards={showcaseCards} />
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
    </>
  )
}
