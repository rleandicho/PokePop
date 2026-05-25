-- Add Cardmarket (EUR) price columns to tcg_prices.
-- Populated by scripts/seed-tcgdex-prices.mjs via the TCGDex API.
ALTER TABLE tcg_prices
  ADD COLUMN IF NOT EXISTS cardmarket_avg   numeric,
  ADD COLUMN IF NOT EXISTS cardmarket_low   numeric,
  ADD COLUMN IF NOT EXISTS cardmarket_trend numeric,
  ADD COLUMN IF NOT EXISTS cardmarket_avg30 numeric;

-- Recreate the view to expose the new columns and include cardmarket_avg
-- in the best_market_price COALESCE fallback chain.
DROP VIEW IF EXISTS tcg_cards_with_price;
CREATE VIEW tcg_cards_with_price AS
SELECT
  c.id,
  c.name,
  c.english_name,
  c.card_language,
  c.supertype,
  c.subtypes,
  c.hp,
  c.types,
  c.evolves_from,
  c.number,
  c.artist,
  c.rarity,
  c.flavor_text,
  c.set_id,
  c.set_name,
  c.series,
  c.release_date,
  c.image_small,
  c.image_large,
  c.jp_image_small,
  c.jp_image_large,
  c.is_wotc,
  p.normal_market,
  p.normal_mid,
  p.normal_low,
  p.holofoil_market,
  p.holofoil_mid,
  p.holofoil_low,
  p.reverse_holo_market,
  p.reverse_holo_mid,
  p.reverse_holo_low,
  p.first_ed_holo_market,
  p.first_ed_normal_market,
  p.other_market,
  p.other_mid,
  p.other_low,
  p.ebay_market,
  p.pricecharting_market,
  p.pricecharting_id,
  p.cardmarket_avg,
  p.cardmarket_low,
  p.cardmarket_trend,
  p.cardmarket_avg30,
  p.price_source,
  p.updated_at AS price_updated_at,
  COALESCE(
    p.holofoil_market,
    p.normal_market,
    p.reverse_holo_market,
    p.first_ed_holo_market,
    p.first_ed_normal_market,
    p.other_market,
    p.cardmarket_avg,
    p.pricecharting_market,
    p.ebay_market
  ) AS best_market_price
FROM tcg_cards c
LEFT JOIN tcg_prices p ON p.card_id = c.id;