# CLAUDE.md

This file provides guidance to Claude Code and other AI agents working in this repository.

## Commands

```bash
npm run dev                    # Start Vite dev server at http://localhost:5173
npm run build                  # Production build to /dist
npm run lint                   # ESLint check
npm run preview                # Preview the production build locally
npm run import-pkmncards       # Dry-run/import PkmnCards-backed set gaps
npm run import-special-promos  # Dry-run/import Trick-or-Trade, Toys"R"Us, Build-A-Bear promos
```

No test suite is configured.

## Environment

Create a `.env` file at the project root with:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # for seeder/cleanup scripts; do not expose in client code
VITE_TCG_API_KEY=...            # pokemontcg.io key, optional but useful for import/price limits
EBAY_CLIENT_ID=...              # eBay Browse API client ID
EBAY_CLIENT_SECRET=...
PRICECHARTING_API_KEY=...
```

## Architecture

Single-page React app. Most app state is managed in `App.jsx`; public share pages use `react-router-dom`.

**View routing** is controlled by `activeVibe` in `App.jsx`:

- `home` renders the editorial home page.
- `wishlist` renders `WishlistDashboard`.
- Other vibe IDs render `CardGrid`.

**Card data** is served from the self-hosted Supabase card database through `tcg_cards_with_price`, not directly from PokemonTCG API at runtime. Import scripts populate gaps from PokemonTCG API, TCGDex, Limitless, PkmnCards, Pokellector, and curated special-promo mappings.

**Supabase tables**

- `profiles`: public profile metadata.
- `wishlists`: collection/wishlist rows, quantities, binder assignment, slot indexes, manual prices, tags, condition, language, category.
- `binders`: user binder metadata and display preferences.
- `follows`: trainer follow graph.
- `tcg_sets`, `tcg_cards`, `tcg_prices`: self-hosted card catalog, metadata, image URLs, and cached prices.
- `card_sales`, `card_trades`: sale/trade history used by the dashboard.

## Key Data Flows

**Collection identity cache**: `App.jsx` fetches `collectionIds`, `ownedIds`, and language ownership once on login, then keeps those sets in sync through callbacks from card add/remove flows.

**Card query layer**: `src/lib/cardDb.js:fetchCardsFromDb` queries `tcg_cards_with_price`, applies vibe filters, set filters, language filters, search aliases, sorting, and pagination. Special search aliases map `trick or treat` / `trick or trade` to `trt22`, `trt23`, and `trt24`; `trt22`, `trt23`, `trt24` to one year; `toysrus` / `toys r us` to `toysrus`; and `build a bear` / `buildabear` to `buildabear`.

**Pagination and caching**: `CardGrid` fetches 20 cards at a time. Results are cached by vibe/search/set/language/sort so the UI does not refetch pages unnecessarily.

**Pricing**: Price priority is generally manual override first, then cached market/mid/low fields. WotC 1st Edition handling remains guarded so Unlimited cards do not inherit `1stEdition*` price keys.

**Sets dropdown**: `AestheticFilter` reads `tcg_sets` from Supabase, caches under `pokepop_sets_v7`, groups by language, then by series. Promo-like sets are grouped under Promos.

**WishlistDashboard / BinderView**: Binders are virtual groupings of owned wishlist rows. `BinderView` renders cards into a slot grid; `buildSlotArray` places cards with known `slot_index` values first, then fills gaps with unplaced cards. Click-to-move works by selecting a card slot, then clicking another card or empty slot. The latest binder fix preserves selected card identity across parent re-renders and keeps virtual duplicate-copy slot IDs separate from real Supabase row IDs.

**Binder quick-add**: Clicking an empty binder slot with no selected card opens a quick-add picker for owned cards not already in the active binder. The picked card receives the clicked `slot_index`.

**Card sell/trade actions**: Collection card tiles include sell/trade controls added by Claude. Selling records a sale price in `card_sales`; trading records the card in `card_trades`. These actions update collection state and feed the dashboard totals/history modals.

**Special promo imports**: `scripts/import-pkmncards.mjs` fixed MEP and fills PkmnCards-backed promo gaps such as SVP. `scripts/import-special-promos.mjs` imports Trick-or-Trade 2022/2023/2024, Toys"R"Us promos, and Build-A-Bear promos. If SVP padded duplicates exist from an older import pass, run `scripts/cleanup-svp-padded-duplicates.sql` in Supabase SQL Editor.

## Component Responsibilities

| Component | Role |
|---|---|
| `App.jsx` | Auth, session state, view routing, collection/owned ID cache |
| `CardGrid.jsx` | Card library UI, pagination, sorting, 1st-Ed split, add/remove to Supabase |
| `AestheticFilter.jsx` | Vibe pills and Supabase-backed set accordion |
| `WishlistDashboard.jsx` | Collection/wishlist dashboard, binder CRUD, sell/trade flows, quick-add picker |
| `BinderView.jsx` | Slot-grid display, click-to-move organization, page management, theme customization |
| `HomePageEditorial.jsx` | Editorial landing/dashboard experience |
| `Auth.jsx` | Sign-in/sign-up/password flows |
| `src/lib/cardDb.js` | Supabase card search/query layer |
| `src/lib/supabase.js` | Single Supabase client instance |
| `src/lib/sets.js` | 1st Edition allow-list and price helpers |

## Notes For Future Agents

- Do not push service-role keys or secrets.
- Do not bulk overwrite sets without a dry-run diff first. Set IDs differ between PkmnCards, PokemonTCG API, and local special-promo set IDs.
- Preserve the strict 20-card grid pagination in the main card library.
- Preserve the pricing firewall that prevents Unlimited cards from reading 1st Edition pricing keys.
- When editing binder behavior, account for quantity-expanded virtual copies and real wishlist row IDs separately.
