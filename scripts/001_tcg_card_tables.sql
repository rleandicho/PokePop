-- ============================================================
-- PokePop – Self-hosted card database migration
-- Run this in the Supabase SQL editor (one time).
-- ============================================================

-- ── Sets ─────────────────────────────────────────────────────
create table if not exists public.tcg_sets (
  id             text primary key,          -- e.g. "base1"
  name           text not null,             -- e.g. "Base Set"
  series         text,                      -- e.g. "Base"
  printed_total  integer,
  total          integer,
  release_date   date,
  symbol_url     text,
  logo_url       text
);

alter table public.tcg_sets enable row level security;
create policy "tcg_sets are publicly readable"
  on public.tcg_sets for select using (true);

-- ── Cards ─────────────────────────────────────────────────────
-- Denormalised: set_name and release_date are copied from tcg_sets
-- so CardGrid queries never need a JOIN for filtering/sorting.
create table if not exists public.tcg_cards (
  id              text primary key,          -- e.g. "base1-4"
  name            text not null,
  supertype       text,                      -- "Pokémon" | "Trainer" | "Energy"
  subtypes        text[],                    -- ["Stage 2", "Mega"]
  hp              text,
  types           text[],                    -- ["Fire"]
  evolves_from    text,
  number          text,
  artist          text,
  rarity          text,
  flavor_text     text,
  set_id          text not null references public.tcg_sets(id),
  set_name        text,                      -- denormalised from tcg_sets for fast filtering
  series          text,                      -- denormalised from tcg_sets for series-level filtering
  release_date    date,                      -- denormalised from tcg_sets for fast sorting
  image_small     text,
  image_large     text,
  is_wotc         boolean default false      -- true for base1–ecard3 (1st Ed eligible sets)
);

-- Full-text search index on name (used by the search bar)
create index if not exists tcg_cards_name_idx on public.tcg_cards using gin (to_tsvector('english', name));
-- Index for set filtering
create index if not exists tcg_cards_set_id_idx on public.tcg_cards (set_id);
-- Index for release date sorting
create index if not exists tcg_cards_release_date_idx on public.tcg_cards (release_date);
-- GIN index on types array (vibe filters like Grass, Fairy)
create index if not exists tcg_cards_types_idx on public.tcg_cards using gin (types);
-- GIN index on subtypes array (Full Art vibe)
create index if not exists tcg_cards_subtypes_idx on public.tcg_cards using gin (subtypes);
-- Index for series-level set filtering
create index if not exists tcg_cards_series_idx on public.tcg_cards (series);

alter table public.tcg_cards enable row level security;
create policy "tcg_cards are publicly readable"
  on public.tcg_cards for select using (true);

-- ── Prices ────────────────────────────────────────────────────
-- Kept separate so we can refresh prices without touching card metadata.
-- Price sync: lazy — only refreshed when a user views a card and the
-- cached price is older than 24 hours.
create table if not exists public.tcg_prices (
  card_id                text primary key references public.tcg_cards(id) on delete cascade,
  normal_market          numeric(10, 2),
  normal_mid             numeric(10, 2),
  normal_low             numeric(10, 2),
  holofoil_market        numeric(10, 2),
  holofoil_mid           numeric(10, 2),
  holofoil_low           numeric(10, 2),
  reverse_holo_market    numeric(10, 2),
  reverse_holo_mid       numeric(10, 2),
  reverse_holo_low       numeric(10, 2),
  first_ed_holo_market   numeric(10, 2),
  first_ed_normal_market numeric(10, 2),
  updated_at             timestamptz default now()
);

-- Index for price-high / price-low sorts
create index if not exists tcg_prices_holofoil_market_idx on public.tcg_prices (holofoil_market desc nulls last);
create index if not exists tcg_prices_normal_market_idx   on public.tcg_prices (normal_market   desc nulls last);

alter table public.tcg_prices enable row level security;
create policy "tcg_prices are publicly readable"
  on public.tcg_prices for select using (true);
-- Allow authenticated users to upsert prices (lazy sync from client)
create policy "authenticated users can upsert prices"
  on public.tcg_prices for all using (auth.role() = 'authenticated');

-- ── View: cards with their best price ────────────────────────
-- CardGrid selects from this view — gives everything in one round trip.
create or replace view public.tcg_cards_with_price as
select
  c.*,
  coalesce(
    p.holofoil_market,
    p.first_ed_holo_market,
    p.normal_market,
    p.reverse_holo_market
  ) as best_market_price,
  p.normal_market,
  p.normal_mid,
  p.normal_low,
  p.holofoil_market,
  p.holofoil_mid,
  p.holofoil_low,
  p.reverse_holo_market,
  p.first_ed_holo_market,
  p.first_ed_normal_market,
  p.updated_at as price_updated_at
from public.tcg_cards c
left join public.tcg_prices p on p.card_id = c.id;
