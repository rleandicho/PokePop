/* global React */
const { useState, useEffect, useRef, useMemo } = React;

// ---------- Card placeholder ----------
// We never have real card art, so render a stylized abstract placeholder
// that varies by name (deterministic hue) and shows the card name.
function PokeCard({ name = "Pikachu", number = "025", set = "Base", rarity = "Holo", height = 220, owned = false, wishlist = false, foil = false }) {
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);

  const aspect = 0.72; // standard pokémon card
  const w = height * aspect;

  return (
    <div
      className="pp-poke-card"
      style={{
        width: w,
        height,
        borderRadius: 12,
        position: "relative",
        background: `linear-gradient(155deg, oklch(55% 0.16 ${hue}) 0%, oklch(35% 0.14 ${(hue + 40) % 360}) 100%)`,
        boxShadow: "0 12px 28px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 30px rgba(0,0,0,0.2)",
        overflow: "hidden",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      {/* art frame */}
      <div style={{
        position: "absolute",
        top: "10%", left: "8%", right: "8%", height: "52%",
        background: `repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 6px, rgba(0,0,0,0.05) 6px 12px), linear-gradient(160deg, oklch(70% 0.16 ${hue}), oklch(45% 0.14 ${(hue+30)%360}))`,
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.18)",
      }} />
      {/* nameplate */}
      <div style={{
        position: "absolute",
        top: "3%", left: "8%", right: "8%",
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        fontFamily: "var(--font-display)",
        fontSize: Math.max(10, height * 0.06),
        color: "rgba(255,255,255,0.95)",
        letterSpacing: "-0.01em",
      }}>
        <span style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: Math.max(7, height * 0.035), opacity: 0.7 }}>HP{40 + (hue % 8) * 10}</span>
      </div>
      {/* description block */}
      <div style={{
        position: "absolute",
        top: "65%", left: "8%", right: "8%", bottom: "12%",
        display: "flex", flexDirection: "column", gap: 3,
      }}>
        {[1, 0.85, 0.7].map((wd, i) => (
          <div key={i} style={{
            height: Math.max(2, height * 0.012),
            width: `${wd * 100}%`,
            background: "rgba(255,255,255,0.18)",
            borderRadius: 1,
          }} />
        ))}
      </div>
      {/* footer */}
      <div style={{
        position: "absolute",
        bottom: "3%", left: "8%", right: "8%",
        display: "flex", justifyContent: "space-between",
        fontFamily: "var(--font-mono)",
        fontSize: Math.max(6, height * 0.028),
        color: "rgba(255,255,255,0.55)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        <span>{set}</span>
        <span>{number}/151</span>
      </div>
      {/* foil shimmer */}
      {foil && (
        <div style={{
          position: "absolute", inset: 0,
          background: "conic-gradient(from 45deg, transparent 0deg, rgba(255,220,180,0.18) 90deg, rgba(180,220,255,0.18) 180deg, rgba(255,180,220,0.18) 270deg, transparent 360deg)",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }} />
      )}
      {/* status badges */}
      {(owned || wishlist) && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          display: "flex", gap: 4,
        }}>
          {owned && <Badge color="oklch(75% 0.16 145)" icon="✓" />}
          {wishlist && <Badge color="oklch(72% 0.18 0)" icon="♥" />}
        </div>
      )}
    </div>
  );
}

function Badge({ color, icon }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 999,
      background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color: "white", fontWeight: 600,
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    }}>{icon}</div>
  );
}

// ---------- Avatar ----------
function Avatar({ name = "U", size = 28, ring = false }) {
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, oklch(70% 0.14 ${hue}), oklch(50% 0.14 ${(hue+60)%360}))`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)", fontWeight: 600,
      fontSize: size * 0.42, color: "white",
      flexShrink: 0,
      border: ring ? "2px solid var(--brand-soft)" : "none",
      boxShadow: ring ? "0 0 0 1px rgba(0,0,0,0.4)" : "none",
    }}>{name.slice(0, 1).toUpperCase()}</div>
  );
}

// ---------- Vibe pill ----------
const VIBES = [
  { id: "girlypop", label: "Girlypop", desc: "Cute & pink", emoji: "🌸", bg: "var(--vibe-girlypop-bg)", ink: "var(--vibe-girlypop-ink)" },
  { id: "space", label: "Space", desc: "Cosmic", emoji: "✦", bg: "var(--vibe-space-bg)", ink: "var(--vibe-space-ink)" },
  { id: "dark", label: "Dark Fairy", desc: "Mysterious", emoji: "♥", bg: "var(--vibe-darkfairy-bg)", ink: "var(--vibe-darkfairy-ink)" },
  { id: "cottage", label: "Cottagecore", desc: "Cozy", emoji: "✿", bg: "var(--vibe-cottage-bg)", ink: "var(--vibe-cottage-ink)" },
  { id: "nature", label: "Nature", desc: "Grass-type", emoji: "✿", bg: "var(--vibe-nature-bg)", ink: "var(--vibe-nature-ink)" },
  { id: "pastel", label: "Pastel", desc: "Fairy softies", emoji: "✦", bg: "var(--vibe-pastel-bg)", ink: "var(--vibe-pastel-ink)" },
  { id: "trainers", label: "Trainers", desc: "Supporters", emoji: "★", bg: "var(--vibe-trainers-bg)", ink: "var(--vibe-trainers-ink)" },
  { id: "fullart", label: "Full Art", desc: "Rare art", emoji: "◆", bg: "var(--vibe-fullart-bg)", ink: "var(--vibe-fullart-ink)" },
];

// ---------- Sample data ----------
const SAMPLE_CARDS = [
  { name: "Charizard", number: "006", set: "Base", rarity: "Holo Rare", owned: true, wishlist: false, foil: true },
  { name: "Pikachu", number: "025", set: "Base", rarity: "Common", owned: true, wishlist: false, foil: false },
  { name: "Mew", number: "151", set: "Promo", rarity: "Secret", owned: false, wishlist: true, foil: true },
  { name: "Blastoise", number: "009", set: "Base", rarity: "Holo Rare", owned: false, wishlist: true, foil: true },
  { name: "Venusaur", number: "003", set: "Base", rarity: "Holo Rare", owned: true, wishlist: false, foil: true },
  { name: "Gengar", number: "094", set: "Fossil", rarity: "Holo Rare", owned: false, wishlist: false, foil: true },
  { name: "Lugia", number: "249", set: "Neo", rarity: "Legendary", owned: false, wishlist: true, foil: true },
  { name: "Eevee", number: "133", set: "Jungle", rarity: "Common", owned: true, wishlist: false, foil: false },
  { name: "Sylveon", number: "684", set: "Evolutions", rarity: "Rare", owned: false, wishlist: true, foil: true },
  { name: "Umbreon", number: "197", set: "Neo", rarity: "Holo Rare", owned: true, wishlist: false, foil: true },
  { name: "Espeon", number: "196", set: "Neo", rarity: "Holo Rare", owned: false, wishlist: false, foil: true },
  { name: "Snorlax", number: "143", set: "Jungle", rarity: "Holo Rare", owned: true, wishlist: false, foil: false },
];

const FRIENDS = [
  { name: "Mira", action: "added", card: "Sylveon", time: "2m" },
  { name: "Jules", action: "wishlisted", card: "Lugia", time: "8m" },
  { name: "Sam", action: "completed", card: "Eevee evolutions set", time: "1h" },
  { name: "Kai", action: "traded for", card: "Charizard", time: "3h" },
  { name: "Ren", action: "added", card: "Mew Promo", time: "5h" },
  { name: "Bex", action: "wishlisted", card: "Umbreon", time: "1d" },
];

// ---------- Phone frame ----------
function PhoneFrame({ children, width = 390, height = 844 }) {
  return (
    <div style={{
      width, height,
      borderRadius: 48,
      padding: 8,
      background: "linear-gradient(180deg, #1a1228 0%, #0a0613 100%)",
      boxShadow: "0 30px 80px -20px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(168,130,255,0.15)",
      position: "relative",
    }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 40,
        overflow: "hidden",
        background: "var(--bg-0)",
        position: "relative",
      }}>
        {/* notch */}
        <div style={{
          position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
          width: 110, height: 30, borderRadius: 999,
          background: "#000", zIndex: 100,
        }} />
        {/* status bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 50, paddingTop: 18,
          display: "flex", justifyContent: "space-between",
          padding: "18px 28px 0",
          fontFamily: "var(--font-sans)",
          fontSize: 14, fontWeight: 600,
          color: "var(--ink-0)",
          zIndex: 50,
          pointerEvents: "none",
        }}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <Signal /><Wifi /><Battery />
          </span>
        </div>
        <div className="pp-scroll" style={{ height: "100%", overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Signal() {
  return <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
    {[2, 4, 6, 8].map((h, i) => <rect key={i} x={i * 4} y={10 - h} width="3" height={h} rx="0.5" fill="white" />)}
  </svg>;
}
function Wifi() {
  return <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M7 9.5a1 1 0 100-2 1 1 0 000 2zM3 5.5l1.4 1.4a3.7 3.7 0 015.2 0l1.4-1.4a5.7 5.7 0 00-8 0zM0 2.5l1.4 1.4a8 8 0 0111.2 0L14 2.5a10 10 0 00-14 0z" fill="white"/></svg>;
}
function Battery() {
  return <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
    <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke="white" strokeOpacity="0.5"/>
    <rect x="2" y="2" width="16" height="7" rx="1" fill="white"/>
    <rect x="21.5" y="3.5" width="2" height="4" rx="1" fill="white" fillOpacity="0.5"/>
  </svg>;
}

// Export to window for cross-file access
Object.assign(window, {
  PokeCard, Avatar, Badge, PhoneFrame, Signal, Wifi, Battery,
  VIBES, SAMPLE_CARDS, FRIENDS,
});
