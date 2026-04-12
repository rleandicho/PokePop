// ─── WotC-era 1st Edition set allow-list ──────────────────────────────────────
// Only these English sets had an official 1st Edition print run.
// Base Set 2 (base4) and Legendary Collection (base6) are excluded — no 1st Ed prints.
export const FIRST_ED_SET_IDS = new Set([
  'base1',   // Base Set
  'base2',   // Jungle
  'base3',   // Fossil
  'base5',   // Team Rocket
  'gym1',    // Gym Heroes
  'gym2',    // Gym Challenge
  'neo1',    // Neo Genesis
  'neo2',    // Neo Discovery
  'neo3',    // Neo Revelation
  'neo4',    // Neo Destiny
  'ecard1',  // Expedition Base Set
  'ecard2',  // Aquapolis
  'ecard3',  // Skyridge
])

/** Returns true if a card_id belongs to a WotC set with a 1st Edition print run. */
export function cardIsWotC(cardId) {
  const setId = (cardId ?? '').split('-')[0].toLowerCase()
  return FIRST_ED_SET_IDS.has(setId)
}

/**
 * Resolves the 1st Edition market price from a TCGPlayer prices object.
 * Strict: only the two canonical 1st Edition keys are checked — no wildcard fallback.
 * Returns null (never an Unlimited price) if neither key exists.
 */
export function get1stEdPrice(prices = {}) {
  if (prices['1stEditionHolofoil']?.market != null) return prices['1stEditionHolofoil'].market
  if (prices['1stEditionNormal']?.market   != null) return prices['1stEditionNormal'].market
  return null
}
