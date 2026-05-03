/**
 * PokePop – Supabase card database query layer
 *
 * Drop-in replacement for pokemontcg.io API calls in CardGrid.jsx.
 * Queries the tcg_cards_with_price view (tcg_cards LEFT JOIN tcg_prices).
 *
 * Public API:
 *   fetchCardsFromDb({ vibe, search, setQuery, sort, page, pageSize })
 *     → { cards: [...], totalPages: number }
 *
 *   refreshPriceIfStale(cardId)
 *     → upserts fresh price to tcg_prices if older than PRICE_TTL_MS
 */

import { supabase } from './supabase.js'

const PAGE_SIZE       = 20
const PRICE_PAGE_SIZE = 500    // Supabase can handle larger batches than the old API
const PRICE_TTL_MS    = 24 * 60 * 60 * 1000  // 24 hours

// Promo set name fragments — mirrors AestheticFilter's PROMO_QUERY logic
const PROMO_NAME_FRAGMENTS = ['%Promo%', '%POP Series%', '%McDonald%']

// ── Vibe → Supabase filter definitions ───────────────────────────────────────
// Each entry is a function that receives a Supabase query builder and returns
// the modified builder. Keep these in sync with VIBE_QUERIES in CardGrid.jsx.

const GIRLYPOP_NAMES = ['cleffa','sylveon','alcremie','jigglypuff','togepi','snubbull','togekiss','clefairy','chansey','happiny','mew','eevee']
const COTTAGECORE_NAMES = ['comfey','roselia','cherubi','shaymin','tangela','bellossom','flabebe','floette','florges','gossifleur','eldegoss']
const DARKFAIRY_NAMES = ['misdreavus','mismagius','gardevoir','hatterene','grimmsnarl','dragapult','gengar','spiritomb']
const SPACE_NAMES = ['lunala','cosmog','cosmoem','minior','jirachi','elgyem','beheeyem','deoxys','solrock','lunatone','cresselia','stakataka','nihilego','solgaleo']
const SPACE_FLAVOR_WORDS = ['space','galaxy','moon','meteor','celestial','cosmic','lunar']
const FULLART_RARITIES = ['Special Illustration Rare','Illustration Rare','Hyper Rare']

// For name-based vibes: match any card whose name contains one of the given words
// e.g. "Clefairy" matches "clefairy", "Clefairy ex", "Mega Clefairy"
function nameOrFilter(names) {
  return names.map(n => `name.ilike.%${n}%`).join(',')
}

const VIBE_FILTERS = {
  girlypop(q)    { return q.or(nameOrFilter(GIRLYPOP_NAMES)) },
  trainers(q)    { return q.eq('supertype', 'Trainer') },
  pastel(q)      { return q.contains('types', ['Fairy']) },
  nature(q)      { return q.contains('types', ['Grass']) },
  cottagecore(q) { return q.or(nameOrFilter(COTTAGECORE_NAMES)) },
  darkfairy(q)   { return q.or(nameOrFilter(DARKFAIRY_NAMES)) },

  fullart(q) {
    // Subtypes contains "Full Art" OR rarity is one of the SV special rarities
    return q.or([
      'subtypes.cs.{"Full Art"}',
      ...FULLART_RARITIES.map(r => `rarity.eq.${r}`)
    ].join(','))
  },

  space(q) {
    const nameParts   = SPACE_NAMES.map(n => `name.ilike.${n}%`)
    const flavorParts = SPACE_FLAVOR_WORDS.map(w => `flavor_text.ilike.%${w}%`)
    const setPart     = 'set_name.ilike.%Cosmic Eclipse%'
    return q.or([...nameParts, ...flavorParts, setPart].join(','))
  },

  starters(q) {
    const names = [
      'bulbasaur','ivysaur','venusaur','charmander','charmeleon','charizard',
      'squirtle','wartortle','blastoise','chikorita','bayleef','meganium',
      'cyndaquil','quilava','typhlosion','totodile','croconaw','feraligatr',
      'treecko','grovyle','sceptile','torchic','combusken','blaziken',
      'mudkip','marshtomp','swampert','turtwig','grotle','torterra',
      'chimchar','monferno','infernape','piplup','prinplup','empoleon',
      'snivy','servine','serperior','tepig','pignite','emboar',
      'oshawott','dewott','samurott','chespin','quilladin','chesnaught',
      'fennekin','braixen','delphox','froakie','frogadier','greninja',
      'rowlet','dartrix','decidueye','litten','torracat','incineroar',
      'popplio','brionne','primarina','grookey','thwackey','rillaboom',
      'scorbunny','raboot','cinderace','sobble','drizzile','inteleon',
      'sprigatito','floragato','meowscarada','fuecoco','crocalor','skeledirge',
      'quaxly','quaxwell','quaquaval',
    ]
    return q.or(nameOrFilter(names))
  },

  dragons(q) {
    const names = [
      'dratini','dragonair','dragonite','kingdra','rayquaza','flygon',
      'vibrava','trapinch','altaria','bagon','shelgon','salamence',
      'latias','latios','gible','gabite','garchomp','axew','fraxure',
      'haxorus','deino','zweilous','hydreigon','druddigon',
    ]
    return q.or([
      'types.cs.{Dragon}',
      ...names.map(n => `name.ilike.%${n}%`)
    ].join(','))
  },

  megaevolution(q) {
    return q.eq('series', 'Mega Evolution')
  },
}

// ── Normalise a card row from the DB into the shape CardGrid expects ──────────
// This keeps CardGrid.jsx changes minimal — it receives the same card shape
// it used to receive from pokemontcg.io, just sourced from Supabase.
function normaliseCard(row) {
  return {
    id:           row.id,
    name:         row.name,
    supertype:    row.supertype,
    subtypes:     row.subtypes ?? [],
    hp:           row.hp,
    types:        row.types ?? [],
    evolvesFrom:  row.evolves_from,
    number:       row.number,
    artist:       row.artist,
    rarity:       row.rarity,
    flavorText:   row.flavor_text,
    images: {
      small: row.image_small,
      large: row.image_large,
    },
    set: {
      id:          row.set_id,
      name:        row.set_name,
      releaseDate: row.release_date,
    },
    // TCGPlayer link — direct URL if stored, otherwise a search link so the modal button always appears
    tcgplayer: {
      url: row.tcgplayer_url
        ?? `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(row.name)}&view=grid`,
      prices: {
        ...(row.normal_market != null ? { normal: { market: row.normal_market, mid: row.normal_mid, low: row.normal_low } } : {}),
        ...(row.holofoil_market != null ? { holofoil: { market: row.holofoil_market, mid: row.holofoil_mid, low: row.holofoil_low } } : {}),
        ...(row.reverse_holo_market != null ? { reverseHolofoil: { market: row.reverse_holo_market, mid: row.reverse_holo_mid, low: row.reverse_holo_low } } : {}),
        ...(row.first_ed_holo_market != null ? { '1stEditionHolofoil': { market: row.first_ed_holo_market } } : {}),
        ...(row.first_ed_normal_market != null ? { '1stEditionNormal': { market: row.first_ed_normal_market } } : {}),
        ...(row.other_market != null ? { other: { market: row.other_market, mid: row.other_mid, low: row.other_low } } : {}),
      }
    },
    // Language of this card's printing (e.g. 'en', 'zh', 'ja')
    card_language:  row.card_language ?? 'en',
    english_name:   row.english_name  ?? row.name,
    // Convenience fields CardGrid reads directly
    market_price:   row.best_market_price ?? null,
    mid_price:      row.holofoil_mid ?? row.normal_mid ?? row.other_mid ?? null,
    low_price:      row.holofoil_low ?? row.normal_low ?? row.other_low ?? null,
    price_updated_at: row.price_updated_at ?? null,
    price_source:          row.price_source ?? null,   // 'tcgplayer' | 'pricecharting' | 'ebay' | null
    ebay_market:           row.ebay_market ?? null,
    pricecharting_market:  row.pricecharting_market ?? null,
    _is_wotc:       row.is_wotc ?? false,
    jp_image_small: row.jp_image_small ?? null,
    jp_image_large: row.jp_image_large ?? null,
  }
}

// ── Main query function ───────────────────────────────────────────────────────
export async function fetchCardsFromDb({ vibe, search, setQuery, sort, page = 1, pageSize, langFilter = null } = {}) {
  const isPriceSort   = sort === 'price-high' || sort === 'price-low'
  const effectiveSize = isPriceSort ? PRICE_PAGE_SIZE : (pageSize ?? PAGE_SIZE)
  const from          = (page - 1) * effectiveSize
  const to            = from + effectiveSize - 1

  // Start with the view that joins prices
  let q = supabase
    .from('tcg_cards_with_price')
    .select('*', { count: 'exact' })

  // ── Apply vibe filter ────────────────────────────────────────
  if (vibe && vibe !== 'all' && VIBE_FILTERS[vibe]) {
    q = VIBE_FILTERS[vibe](q)
  }

  // ── Apply set filter (from AestheticFilter dropdown) ─────────
  // AestheticFilter generates three formats:
  //   "set.id:base1"              → exact set
  //   'set.series:"Sword & Shield"' → all sets in a series
  //   PROMO_QUERY string          → promo sets (name-based)
  if (setQuery) {
    const setIdMatch     = setQuery.match(/^set\.id:(\S+)$/)
    const seriesMatch    = setQuery.match(/^set\.series:"(.+)"$/)
    const isPromoQuery   = setQuery.includes('set.name:') && setQuery.includes('Promo')

    if (setIdMatch) {
      q = q.eq('set_id', setIdMatch[1])
    } else if (seriesMatch) {
      q = q.eq('series', seriesMatch[1])
    } else if (isPromoQuery) {
      // Match promo set names + PROMO subtype (mirrors AestheticFilter PROMO_QUERY)
      const promoOr = [
        ...PROMO_NAME_FRAGMENTS.map(f => `set_name.ilike.${f}`),
        'subtypes.cs.{PROMO}',
      ].join(',')
      q = q.or(promoOr)
    }
    // Unknown formats fall through with no filter (shows all cards)
  }

  // ── Language filter ──────────────────────────────────────────
  // null = all languages; any valid code restricts to that language
  if (langFilter) {
    q = q.eq('card_language', langFilter)
  }

  // ── Apply name/set search ────────────────────────────────────
  // Supports five modes:
  //   "swshp-SWSH094" → exact card ID lookup
  //   "SWSH094"       → card number lookup (promo-style: letters + digits)
  //   "094"           → exact card number (pure digits)
  //   "Haunter 56"    → name contains "Haunter" AND number = "56"
  //   "Gengar"        → name, english_name, or set_name contains the phrase
  if (search && search.trim()) {
    const s = search.trim()

    // Card ID: setId-number, e.g. "swshp-SWSH094", "sv3pt5-144", "base1-4"
    // Right part must contain at least one digit to distinguish from Pokémon names like "Ho-Oh"
    const cardIdMatch = s.match(/^([a-zA-Z0-9]{2,10})-([a-zA-Z0-9]*\d[a-zA-Z0-9]*)$/)

    // Promo-style number: 2–6 letters + 2–4 digits, no spaces, e.g. SWSH094, XY123, GG26, TG30
    const promoNumMatch = !cardIdMatch && s.match(/^[A-Za-z]{2,6}\d{2,4}$/)

    // Pure number: 1–4 digits only, e.g. "4", "94", "094"
    const pureNumMatch = !cardIdMatch && !promoNumMatch && s.match(/^\d{1,4}$/)

    if (cardIdMatch) {
      // Case-insensitive exact ID match (ilike without wildcards = case-insensitive =)
      q = q.ilike('id', s)
    } else if (promoNumMatch) {
      // Case-insensitive number match, e.g. "swsh094" finds number "SWSH094"
      q = q.ilike('number', s)
    } else if (pureNumMatch) {
      q = q.eq('number', s)
    } else {
      // "Haunter 56" → name AND number (also handle hyphen: "haunter-56")
      const nameNumMatch = s.replace(/-/g, ' ').match(/^(.+?)\s+(\d+)$/)
      if (nameNumMatch) {
        q = q.or(`name.ilike.%${nameNumMatch[1].trim()}%,english_name.ilike.%${nameNumMatch[1].trim()}%`)
        q = q.eq('number', nameNumMatch[2])
      } else {
        // Normalize hyphens to spaces ("felt-hat-pikachu" → "felt hat pikachu"),
        // then split into words. All words must match somewhere (AND semantics),
        // each word may appear in name, english_name, or set_name (OR within word).
        const words = s.replace(/-/g, ' ').trim().split(/\s+/).filter(Boolean)
        for (const word of words) {
          q = q.or(`name.ilike.%${word}%,english_name.ilike.%${word}%,set_name.ilike.%${word}%`)
        }
      }
    }
  }

  // ── Apply sort + pagination ──────────────────────────────────
  if (isPriceSort) {
    // Sort by best available price, nulls last
    q = q.order('best_market_price', { ascending: sort === 'price-low', nullsFirst: false })
  } else if (search && search.trim() && sort === 'newest') {
    // When searching, group same-Pokémon cards together across all languages
    // instead of burying older-release languages (e.g. Japanese) on later pages
    q = q.order('english_name', { ascending: true, nullsFirst: false })
         .order('number',        { ascending: true })
         .order('release_date',  { ascending: false })
  } else if (sort === 'newest') {
    q = q.order('release_date', { ascending: false }).order('number', { ascending: true })
  } else if (sort === 'alpha') {
    q = q.order('name', { ascending: true })
  } else {
    // oldest (default)
    q = q.order('release_date', { ascending: true }).order('number', { ascending: true })
  }

  q = q.range(from, to)

  const { data, error, count } = await q

  if (error) throw new Error(`cardDb fetchCards: ${error.message}`)

  const totalPages = Math.ceil((count ?? 0) / effectiveSize)
  const cards = (data ?? []).map(normaliseCard)

  return { cards, totalPages }
}

// ── Lazy price refresh ────────────────────────────────────────────────────────
// Called when a user opens a card detail modal.
// If the stored price is stale (> 24h), fetches fresh from pokemontcg.io API
// and upserts to tcg_prices. This keeps prices current without a scheduled job.
export async function refreshPriceIfStale(cardId, tcgApiKey) {
  // Check current price age
  const { data: existing } = await supabase
    .from('tcg_prices')
    .select('updated_at')
    .eq('card_id', cardId)
    .maybeSingle()

  if (existing?.updated_at) {
    const age = Date.now() - new Date(existing.updated_at).getTime()
    if (age < PRICE_TTL_MS) return  // still fresh — nothing to do
  }

  // Fetch fresh price from pokemontcg.io
  try {
    const headers = tcgApiKey ? { 'X-Api-Key': tcgApiKey } : {}
    const res  = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(cardId)}?select=id,tcgplayer`, { headers })
    if (!res.ok) return
    const { data: card } = await res.json()
    if (!card) return

    const p = card.tcgplayer?.prices ?? {}

    // Scan all tiers for a generic "other" price (e.g. Perfect Order, non-standard sets).
    // Skip well-known keys that have their own columns; skip 1stEdition* for unlimited.
    const KNOWN_KEYS = new Set(['normal','holofoil','reverseHolofoil','1stEditionHolofoil','1stEditionNormal'])
    const otherTier = Object.entries(p).find(([k]) => !KNOWN_KEYS.has(k) && p[k]?.market != null)
    const otherData = otherTier ? otherTier[1] : null

    const priceRow = {
      card_id:                cardId,
      normal_market:          p.normal?.market          ?? null,
      normal_mid:             p.normal?.mid             ?? null,
      normal_low:             p.normal?.low             ?? null,
      holofoil_market:        p.holofoil?.market        ?? null,
      holofoil_mid:           p.holofoil?.mid           ?? null,
      holofoil_low:           p.holofoil?.low           ?? null,
      reverse_holo_market:    p.reverseHolofoil?.market ?? null,
      reverse_holo_mid:       p.reverseHolofoil?.mid    ?? null,
      reverse_holo_low:       p.reverseHolofoil?.low    ?? null,
      first_ed_holo_market:   p['1stEditionHolofoil']?.market ?? null,
      first_ed_normal_market: p['1stEditionNormal']?.market   ?? null,
      other_market:           otherData?.market ?? null,
      other_mid:              otherData?.mid    ?? null,
      other_low:              otherData?.low    ?? null,
      updated_at:             new Date().toISOString(),
    }

    await supabase.from('tcg_prices').upsert(priceRow, { onConflict: 'card_id' })
  } catch {
    // Silently fail — we still have the cached (stale) price to show
  }
}
