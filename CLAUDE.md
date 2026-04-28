# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build to /dist
npm run lint      # ESLint check
npm run preview   # Preview the production build locally
```

No test suite is configured.

## Environment

Create a `.env` file at the project root with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # for seeder scripts
VITE_TCG_API_KEY=...            # pokemontcg.io key (optional, increases rate limit)
EBAY_CLIENT_ID=...              # eBay developer Client ID (Browse API, free at developer.ebay.com)
EBAY_CLIENT_SECRET=...          # eBay developer Client Secret
PRICECHARTING_API_KEY=...       # free key from pricecharting.com/api
```

## Architecture

Single-page React app (no routing except `PublicWishlist` via react-router-dom). All state is managed in `App.jsx` — there is no global store.

**View routing** is controlled by `activeVibe` (string) in `App.jsx`:
- `'home'` → `HomePage`
- `'wishlist'` → `WishlistDashboard`
- anything else → `CardGrid` (filtered by vibe)

**Card data** comes exclusively from the [Pokémon TCG API](https://api.pokemontcg.io/v2/cards). No card data is stored in Supabase — only user wishlists and binder metadata.

**Supabase tables:**
- `profiles` — `{ id, username }` — one row per auth user
- `wishlists` — `{ user_id, card_id, owned, binder_id, slot_index, manual_price, market_price, mid_price, low_price }`

### Key data flows

**`collectionIds` / `ownedIds`** — Sets of card IDs fetched once on login (`App.jsx:fetchCollectionIds`), then kept in sync via `onCardAdded` / `onCardRemoved` callbacks threaded down to `CardGrid`. This avoids re-fetching Supabase on every card interaction.

**TCG query building** — `CardGrid.jsx:buildTcgQuery` assembles the `q=` parameter from three independent parts: a name wildcard search, a set filter (`setQuery`), and a vibe filter (`VIBE_QUERIES`). Parts are AND-joined with spaces. Vibe filter is skipped for `'all'`.

**Pagination & caching** — `CardGrid` fetches 20 cards at a time (`PAGE_SIZE`). All pages for a given filter combination are accumulated in a `resultsCache` ref (LRU, max 10 entries). The cache key is `vibe|search|setQuery` — sort is excluded because sorting is done client-side after fetch.

**1st Edition pricing** — WotC sets (base1–ecard3) are tracked in `src/lib/sets.js:FIRST_ED_SET_IDS`. Cards from these sets are split into two entries at fetch time: one `_is1stEd: true` entry and one Unlimited entry. `get1stEdPrice` reads only the `1stEditionHolofoil` / `1stEditionNormal` TCGPlayer tiers. Unlimited cards never touch those keys (`getBestPrice` in `CardGrid.jsx` explicitly excludes `1stEdition*`).

**Sets dropdown** — `AestheticFilter` fetches the full set list from the TCG API and caches it in `localStorage` under `pokepop_sets_v1` with a 24-hour TTL. An in-memory reference (`setsCache`) prevents redundant `JSON.parse` calls within a session.

**WishlistDashboard / BinderView** — Binders are virtual groupings of wishlist rows. `BinderView` renders cards into a slot grid; `buildSlotArray` places cards with a known `slot_index` first, then fills gaps with unplaced cards. Price resolution priority: `manual_price → market_price → mid_price → low_price`.

### Component responsibilities

| Component | Role |
|---|---|
| `App.jsx` | Auth, session state, view routing, collectionIds/ownedIds cache |
| `CardGrid.jsx` | TCG API fetching, pagination, sort, 1st-Ed split, add/remove to Supabase |
| `AestheticFilter.jsx` | Vibe pills + sets accordion; calls back with `setQuery` fragments |
| `WishlistDashboard.jsx` | Binder CRUD, per-binder stats, pagination |
| `BinderView.jsx` | Slot-grid display, drag-to-reorder, theme customization |
| `HomePage.jsx` | Landing bento grid + collection summary for logged-in users |
| `Auth.jsx` | Sign-in/sign-up/forgot-password modal |
| `src/lib/supabase.js` | Single Supabase client instance |
| `src/lib/sets.js` | 1st Edition set allow-list + price helpers |
