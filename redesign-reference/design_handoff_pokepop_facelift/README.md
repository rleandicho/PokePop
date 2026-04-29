# Handoff: Poképop Facelift — Editorial Spotlight (Mobile + Desktop)

## Overview

This handoff covers a facelift for the Poképop home/dashboard — a Pokémon card discovery, collection-management, and social platform. The redesign moves away from the current button-heavy layout toward an **editorial, content-first home** anchored by a rotating featured-card spotlight, with friend-activity context and the existing "Browse by Vibe" pivot retained as a first-class feature.

Two layouts are in scope:

1. **Mobile (390 × 844)** — `HomeEditorial` — rotating featured-card hero, inline stat row, vibe grid + horizontal scroll, friends-activity teaser, bottom tab bar.
2. **Desktop (1280 × 800)** — `DesktopEditorial` — three-pane layout: sidebar (library + vibes), main column (hero + recent + vibes), right rail (friend activity + trending in circle).

## About the Design Files

The files in `source/` are **design references created in HTML/JSX** — prototypes that show the intended look, layout, type system, and behavior. They are **not production code to copy directly**.

Your task is to **recreate these designs in the existing Poképop codebase** using its established framework (React/Next.js/Vue/SwiftUI/etc.) and component patterns. Lift the design tokens, layout structure, type treatment, and interaction details exactly — but build the components against your existing data models, routing, auth, and theming systems.

If the codebase has an existing component library or design system, prefer composing existing primitives over hand-rolling new ones. If a primitive doesn't exist (e.g., the rotating featured-card hero), build it as a new component that lives alongside the existing system.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, motion, and interaction states are specified. Recreate pixel-perfectly, then adapt density and breakpoints to match Poképop's responsive system.

## Files

- `source/styles.css` — All design tokens (CSS custom properties), utility classes (`.pp-card`, `.pp-btn`, `.pp-display`, `.pp-tilt`, `.pp-live-dot`, etc.), and shared animations (ticker, holo shine, pulse).
- `source/components.jsx` — Shared building blocks: `PokeCard` (placeholder card visualization), `Avatar`, `Badge`, `PhoneFrame` (for prototype only), `VIBES` data, `SAMPLE_CARDS` data, `FRIENDS` data.
- `source/v1-editorial.jsx` — Mobile `HomeEditorial` page + helpers (`Stat`, `IconBtn`, `SectionHeader`, `VibeTile`, `FriendRow`, `BottomNav`).
- `source/desktop-editorial.jsx` — Desktop `DesktopEditorial` page + `SideItem` helper.

The two page files **share** the helpers in `components.jsx` and tokens in `styles.css`. In your codebase, `FriendRow` is defined in `v1-editorial.jsx` and reused by the desktop layout — promote it to a shared component.

## Design Tokens

All tokens are in `styles.css` under `:root`. Reproduce them in your codebase's token system (CSS variables, design tokens JSON, theme config — whatever the project uses).

### Colors

**Backgrounds (dark theme)**
- `--bg-0: #0a0613` — page base
- `--bg-1: #120a24`
- `--bg-2: #1a0f33`
- `--bg-3: #251746`
- `--bg-card: rgba(40, 25, 70, 0.55)` — translucent card background
- `--bg-card-strong: rgba(50, 32, 88, 0.85)` — solid card background (active states)

**Page background** (the layered radial-glow effect):
```css
background:
  radial-gradient(ellipse 60% 50% at 20% 0%, rgba(122, 60, 220, 0.35), transparent 60%),
  radial-gradient(ellipse 50% 40% at 90% 100%, rgba(220, 80, 200, 0.18), transparent 60%),
  radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20, 12, 40, 0.6), transparent 70%),
  #0a0613;
```

**Borders**
- `--border: rgba(168, 130, 255, 0.14)`
- `--border-strong: rgba(168, 130, 255, 0.28)`

**Ink (text)**
- `--ink-0: #f4eeff` — primary
- `--ink-1: #cdc1e6` — secondary
- `--ink-2: #8d82a8` — tertiary / labels
- `--ink-3: #5b5072` — disabled / metadata

**Brand**
- `--brand: oklch(72% 0.19 305)` — electric purple primary
- `--brand-soft: oklch(80% 0.12 305)` — softer accent
- `--brand-glow: oklch(72% 0.19 305 / 0.35)` — for glow/shadow
- `--gold: oklch(82% 0.13 85)` — holographic gold accent
- `--pink: oklch(78% 0.16 0)`
- `--mint: oklch(82% 0.12 165)`
- `--sky: oklch(78% 0.13 235)`

**Vibe palette** (background + ink pairs — use for vibe tiles and chips)
| Vibe | BG | Ink |
|---|---|---|
| Girlypop | `oklch(82% 0.10 0)` | `oklch(35% 0.10 0)` |
| Space | `oklch(78% 0.09 240)` | `oklch(30% 0.09 240)` |
| Dark Fairy | `oklch(72% 0.10 290)` | `oklch(98% 0.02 290)` |
| Cottagecore | `oklch(85% 0.10 145)` | `oklch(32% 0.10 145)` |
| Nature | `oklch(80% 0.13 130)` | `oklch(28% 0.10 130)` |
| Pastel | `oklch(90% 0.08 90)` | `oklch(38% 0.08 90)` |
| Trainers | `oklch(88% 0.07 60)` | `oklch(35% 0.08 60)` |
| Full Art | `oklch(85% 0.09 320)` | `oklch(32% 0.10 320)` |

### Typography

Three families. Load via Google Fonts (or self-host equivalents):

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- `--font-display: "Instrument Serif", Georgia, serif` — used for all headlines and page titles. Italic variant is used for emphasis (the `<em>` inside `.pp-display`) and gets the gradient-clip treatment.
- `--font-sans: "Geist", -apple-system, sans-serif` — body, UI labels.
- `--font-mono: "Geist Mono", ui-monospace` — numeric metadata (counts, card numbers, timestamps).

**Display headline** (`.pp-display`): font-weight 400, letter-spacing -0.02em, line-height 0.95.

**Display em treatment**: italic + gradient-clipped:
```css
.pp-display em {
  font-style: italic;
  background: linear-gradient(135deg, var(--brand-soft), var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

### Spacing

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-5: 24px` · `--space-6: 32px` · `--space-7: 48px` · `--space-8: 64px`.

### Radii

- `--radius-sm: 8px` — small chips, icon buttons
- `--radius-md: 14px` — cards (compact)
- `--radius-lg: 20px` — cards (default)
- `--radius-xl: 28px` — featured spotlight, hero containers
- `--radius-pill: 999px` — buttons, pills, chips

### Shadows

- `--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3)`
- `--shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.04) inset`
- `--shadow-glow: 0 0 40px var(--brand-glow)` — for primary buttons and hovered cards
- `--shadow-card: 0 20px 60px -10px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.06) inset`

---

## Screen 1 · Mobile Home (`HomeEditorial`)

**Frame:** 390 × 844 (iPhone 14/15 Pro). Vertical scroll. Bottom tab bar is sticky.

**File:** `source/v1-editorial.jsx`

### Layout (top → bottom)

All horizontal padding is `20px` unless noted.

1. **Top bar** — 60px tall, padding `0 20px 18px`. Flex row, `justify-content: space-between`.
   - Left: 32px `Avatar` (with brand-soft ring) + 2-line label: kicker "COLLECTOR" (11px, ink-2, uppercase, letter-spacing 0.05em) + `@username` (14px, weight 600, ink-0).
   - Right: 2 × `IconBtn` (38×38, rounded-full, transparent bg, 1px ink-2 border). The notifications icon has a pink badge with count.

2. **Editorial headline block** — padding `0 20px 20px`.
   - Date kicker: 11px, ink-2, uppercase, letter-spacing 0.18em, `Tuesday · April 28`.
   - H1 (`.pp-display`): 40px, two lines, `Welcome back,` + `<em>collector.</em>` (italic gradient-clipped).
   - Inline stat row: 13px ink-1, format `**9** saved · **4** owned · **5** on wishlist` with bullet separators in ink-3.

3. **Featured card spotlight** — padding `0 20px 32px`.
   - Container: `padding: 18px`, `border-radius: 28px` (radius-xl), `background: linear-gradient(155deg, rgba(60,40,110,0.7), rgba(30,18,60,0.85))`, `position: relative`, `overflow: hidden`.
   - Behind everything: a radial-gradient overlay tinted by the current featured card's hue, with a 1.2s `transition: background` so it crossfades on rotation.
   - Layout: flex row, `gap: 16px`, `align-items: center`.
     - Left: `PokeCard` at `height={180}` wrapped in `.pp-tilt` (perspective rotate on hover).
     - Right: column. Subtitle kicker (10px, brand-soft, uppercase, letter-spacing 0.15em) → card name (.pp-display, 22px) → italic tagline (12px, font-display italic, ink-1, in quotes) → 2 chips (`.pp-chip`).
   - Pagination dots: 3 dots centered below content, 5px tall. Active is 18px wide, brand-soft. Inactive is 5×5, white-20.
   - **Auto-rotate**: index advances every 5000ms via `setInterval`. Use `useEffect` cleanup.

4. **"Continue" section** — `SectionHeader` with kicker "PICK UP WHERE YOU LEFT OFF" + title "Continue", followed by horizontal-scrolling card row at `height={160}`.

5. **"Browse by vibe" section** — `SectionHeader` with kicker "BROWSE THE CATALOG" + title "By vibe". 4 vibe tiles in a 2×2 grid (girlypop, space, dark, cottage), then a horizontal-scroll row of the remaining 4 in compact form.

6. **"Friends" section** — `SectionHeader` with kicker "YOUR CIRCLE" + title "Friends" + right-side "See all →" link. Below: 4 `FriendRow`s with 1px border-bottom dividers.

7. **"Surprise me" CTA** — full-width button-card, padding 18px, border-radius 18px, background `linear-gradient(135deg, oklch(50% 0.15 305), oklch(45% 0.18 340))`, border `1px solid var(--border-strong)`. Left side: title "Surprise me" (16px, weight 600) + subtitle "Random card · pulled from 18,000+" (12px, opacity 0.75). Right side: 22px die glyph `⚄`.

8. **Bottom tab bar** (`BottomNav`) — sticky bottom, `rgba(10, 6, 19, 0.85)` + `backdrop-filter: blur(20px)`, `1px solid var(--border)` top border. Padding `10px 20px 24px` (extra bottom for safe area). 4 tabs: Home (active, brand-soft), Browse, Library, Friends. Each tab: 18px icon glyph + 10px label, ink-2 inactive, brand-soft active.

### Featured-card data (rotation source)
```js
[
  { name: "Charizard", number: "006", set: "Base", rarity: "Holo Rare",
    foil: true, tagline: "The original holo.", subtitle: "Featured today" },
  { name: "Lugia", number: "249", set: "Neo", rarity: "Legendary",
    foil: true, tagline: "Sea guardian, mythic.", subtitle: "From the wishlist of 12 friends" },
  { name: "Mew", number: "151", set: "Promo", rarity: "Secret",
    foil: true, tagline: "Whispered into existence.", subtitle: "Newly indexed" },
]
```

In production: feed this from your backend (e.g., `/api/featured-cards/today`). Cache server-side, rotate daily or weekly.

---

## Screen 2 · Desktop Home (`DesktopEditorial`)

**Frame:** 1280 × 800 (designed) — but the layout is fluid; treat 1280 as the design baseline and let it stretch on wider viewports. Below ~1100px wide, collapse to mobile layout.

**File:** `source/desktop-editorial.jsx`

### Layout

CSS Grid: `grid-template-columns: 220px 1fr 320px`, `grid-template-rows: 60px 1fr`.

1. **Top bar** (spans all 3 columns, 60px) — wordmark + horizontal nav (`Home · Browse · My library · Friends · Trades`) on the left; search input (320px wide, `⌘K` keyboard hint at right) + 32px avatar on the right. `border-bottom: 1px solid var(--border)`, background `rgba(10,6,19,0.6)` + blur.

2. **Sidebar** (220px, left column) — sections separated by 1px hairlines:
   - **LIBRARY**: `All cards (9)` (active), `Owned (4)`, `Wishlist (5)`, `Recent`.
   - **VIBES**: 6 vibe items, each rendered as a 12×12 square swatch (vibe bg color) + label (no count).
   - Each `SideItem`: padding `8px 10px`, border-radius 8px. Active gets `bg-card-strong` background.

3. **Main column** (1fr, scrolls vertically):
   - Date kicker: 11px ink-2 uppercase, `Tuesday · April 28`.
   - H1 (.pp-display): **56px**, single line: `Welcome back, <em>collector.</em>`.
   - **Featured card hero**: 28px padding, 24px radius, gradient bg same as mobile. Two-column grid (auto + 1fr), gap 32px. Card at `height={280}`. Right side: kicker → card name (.pp-display, 48px) → italic tagline (16px, max-width 460, line-height 1.5) → 3 chips → primary CTA "+ Add to library" + ghost CTA "View on TCGplayer →".
   - **Continue browsing** section: H2 (.pp-display, 28px) + right-aligned "Last visited 2h ago" metadata. Below: row of 6 cards at `height={200}`, gap 14px.
   - **Browse by vibe** section: H2 (.pp-display, 28px). Below: 4-column grid of all 8 vibe tiles, 14px gap, padding 18px, radius 16px.

4. **Right rail** (320px, scrolls vertically) — `border-left: 1px solid var(--border)`, padding 20px 18px:
   - Header: pulsing live-dot (`.pp-live-dot`) + "FRIEND ACTIVITY" kicker; subtitle "3 of 8 friends online".
   - List of 6 `FriendRow`s.
   - 1px hairline divider.
   - "TRENDING IN YOUR CIRCLE" kicker.
   - 3 trending rows: 70px-tall mini card + 3-line meta (name, set·rarity, "+N wishlists today" in brand-soft).

---

## Components Reference

### `PokeCard` (placeholder)

Live in `components.jsx`. **In production, replace with real card-image rendering** — but keep these characteristics:
- Aspect ratio **0.72** (height controls; width = `height * 0.72`).
- Hover-tilt via `.pp-tilt` class.
- Foil shimmer overlay (conic-gradient, `mix-blend-mode: overlay`) when `foil={true}`.
- Status badge dots (top-right): green check for `owned`, red heart for `wishlist`.
- 12px border-radius. Box-shadow: `0 12px 28px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 30px rgba(0,0,0,0.2)`.

### `Avatar`

Circular gradient background derived deterministically from the name (string hash → hue). First letter rendered in white at 42% of avatar size. Optional `ring` prop adds a 2px brand-soft border + dark outer ring.

### Buttons

```css
.pp-btn          /* base: pill, var(--bg-card-strong), 1px border-strong, ink-0 */
.pp-btn-primary  /* gradient brand → 320° hue, no border, brand-glow shadow */
.pp-btn-ghost    /* transparent, 1px var(--border) */
```

All have `transition: 0.18s` and `translateY(-1px)` on hover.

### Chips

`.pp-chip` — pill, padding `5px 11px`, 12px font, ink-1, transparent bg, 1px border, 6px gap if it has an icon.

---

## Interactions & Behavior

### Featured card rotation
- Auto-advance every 5000ms.
- Pagination dots clickable to jump (build this if not present in mock).
- Crossfade behind-glow tint via 1.2s transition on the radial-gradient color (driven by hue derived from the active card's name).

### Card hover
- `.pp-tilt` applies `transform: perspective(800px) rotateX(4deg) rotateY(-6deg) translateZ(8px)` over 0.3s with `cubic-bezier(0.2, 0.8, 0.2, 1)` easing.
- Optional: `.pp-holo` adds a rotating conic-gradient overlay on hover (180deg sweep over 0.6s).

### Live dot
`.pp-live-dot` — 6×6 circle, oklch(75% 0.20 25), 1.6s `pp-pulse-dot` keyframe (scale 1→1.4 + opacity 1→0.5), with matching color glow shadow.

### Bottom nav
Mobile only. Active tab uses brand-soft color; switching tabs should navigate (use your router).

### Click targets / next screens (not in scope but referenced)
- Featured card → card detail page.
- Vibe tile → browse, filtered by that vibe.
- Friend row → friend profile.
- "Surprise me" → random card detail page.
- "View on TCGplayer →" → external link to TCGplayer's page for that card (open in new tab).

---

## State Management

Minimal — most surfaces are read-only displays.

- **Featured-card index** (mobile + desktop): local state, `useState(0)`. Rotates on interval. No persistence.
- **User stats** (saved/owned/wishlist counts): from your existing collection store/API.
- **Friends activity**: from your existing social/activity feed API. Mock shape:
  ```ts
  type Activity = { name: string; action: string; card: string; time: string };
  ```
- **Continue browsing**: from a "recently viewed" store keyed to the user.

No new global state is introduced by this design.

---

## Responsive

- **≥ 1100px**: desktop layout (`DesktopEditorial`).
- **< 1100px**: mobile layout (`HomeEditorial`). Single column, bottom tab bar replaces the top nav.

You can also support a **tablet** breakpoint (768–1099px) if useful: same layout as desktop but collapse the right rail to a slide-over drawer triggered from a top-bar button.

---

## Light Mode

Not in scope for this handoff. The current Poképop site already has a light mode toggle — when implementing, mirror your existing dark/light token mapping. The vibe palette (girlypop/space/etc.) works in both modes; only the bg/ink/border tokens flip.

---

## Assets

- **No real card images used.** `PokeCard` renders a stylized placeholder. In production, swap it for a real card-image component that loads from your CDN/PokémonTCG API and pass the same props (`name`, `number`, `set`, `rarity`, `foil`, `owned`, `wishlist`).
- **No icons used from a library.** All glyphs (`⌂`, `▤`, `⊞`, `◯`, `🔍`, `✓`, `♥`, `+`, `−`, `⚄`) are Unicode. **Recommend swapping for your existing icon library** (Lucide, Heroicons, Phosphor, etc.) for consistency and proper sizing/alignment.
- **Fonts:** Instrument Serif, Geist, Geist Mono — available from Google Fonts.

---

## Implementation Checklist

1. [ ] Add tokens from `styles.css` to your token system.
2. [ ] Load Instrument Serif + Geist + Geist Mono fonts.
3. [ ] Build/adapt `PokeCard` to render against your real card-image source.
4. [ ] Build `Avatar` (or use existing) — with deterministic hue + optional ring.
5. [ ] Wire `BottomNav` to your router (mobile).
6. [ ] Wire desktop top nav to your router.
7. [ ] Implement featured-card rotation (interval + clickable dots).
8. [ ] Build hero, "Continue", "Browse by vibe", and "Friends" sections — connect to real data sources.
9. [ ] Build right rail (desktop only) — friend activity + trending in circle.
10. [ ] Match light-mode token mapping to your existing system.
11. [ ] Verify hover/tilt and live-dot animations match.
12. [ ] Validate accessibility: heading order (h1 → h2), focus states on all interactive elements, sufficient contrast on the vibe tiles, prefers-reduced-motion handling for the rotation/tilt.
