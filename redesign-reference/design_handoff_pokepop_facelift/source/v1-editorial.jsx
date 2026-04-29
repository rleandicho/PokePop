/* global React, PokeCard, Avatar, PhoneFrame, VIBES, SAMPLE_CARDS, FRIENDS */
const { useState: useStateV1, useEffect: useEffectV1, useMemo: useMemoV1 } = React;

// V1 — Editorial Spotlight
// A featured card hero (rotating spotlight), editorial type treatment,
// by-the-book browse pivot below. Less buttons, more content.
function HomeEditorial({ density = "comfy" }) {
  const [featured, setFeatured] = useStateV1(0);
  useEffectV1(() => {
    const t = setInterval(() => setFeatured((f) => (f + 1) % 3), 5000);
    return () => clearInterval(t);
  }, []);

  const featuredCards = [
    { ...SAMPLE_CARDS[0], tagline: "The original holo.", subtitle: "Featured today" },
    { ...SAMPLE_CARDS[6], tagline: "Sea guardian, mythic.", subtitle: "From the wishlist of 12 friends" },
    { ...SAMPLE_CARDS[2], tagline: "Whispered into existence.", subtitle: "Newly indexed" },
  ];
  const F = featuredCards[featured];

  return (
    <div className={`pp-bg pp-section ${density === "compact" ? "pp-compact" : ""}`} style={{
      minHeight: "100%",
      paddingTop: 60,
      fontFamily: "var(--font-sans)",
      color: "var(--ink-0)",
    }}>
      {/* Top bar — minimal, no sign-out shouting */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name="testUser2" size={32} ring />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.05em", textTransform: "uppercase" }}>collector</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>@testUser2</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <IconBtn icon="🔍" />
          <IconBtn icon="◷" badge="3" />
        </div>
      </div>

      {/* Editorial headline */}
      <div style={{ padding: "0 20px 20px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
          Tuesday · April 28
        </div>
        <h1 className="pp-display" style={{ fontSize: 40, margin: 0, marginBottom: 4 }}>
          Welcome back,<br />
          <em>collector.</em>
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 10, display: "flex", gap: 14 }}>
          <Stat n="9" label="saved" />
          <span style={{ color: "var(--ink-3)" }}>·</span>
          <Stat n="4" label="owned" />
          <span style={{ color: "var(--ink-3)" }}>·</span>
          <Stat n="5" label="on wishlist" />
        </div>
      </div>

      {/* Featured card spotlight */}
      <div style={{ padding: "0 20px 32px", position: "relative" }}>
        <div className="pp-card" style={{
          padding: 18,
          borderRadius: "var(--radius-xl)",
          background: "linear-gradient(155deg, rgba(60,40,110,0.7), rgba(30,18,60,0.85))",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: -40,
            background: `radial-gradient(circle at 50% 30%, oklch(70% 0.18 ${(featured * 90) % 360} / 0.4), transparent 60%)`,
            transition: "background 1.2s ease",
          }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
            <div className="pp-tilt" style={{ flexShrink: 0 }}>
              <PokeCard {...F} height={180} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--brand-soft)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>
                {F.subtitle}
              </div>
              <div className="pp-display" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 8 }}>
                {F.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-1)", lineHeight: 1.4, marginBottom: 12, fontStyle: "italic", fontFamily: "var(--font-display)" }}>
                "{F.tagline}"
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="pp-chip">{F.set}</span>
                <span className="pp-chip">{F.rarity}</span>
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", justifyContent: "center", gap: 4, marginTop: 16,
          }}>
            {featuredCards.map((_, i) => (
              <div key={i} style={{
                width: i === featured ? 18 : 5, height: 5, borderRadius: 999,
                background: i === featured ? "var(--brand-soft)" : "rgba(255,255,255,0.2)",
                transition: "all 0.3s",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Continue your collection — friend-aware */}
      <SectionHeader kicker="Pick up where you left off" title="Continue" />
      <div className="pp-hscroll" style={{ padding: "0 20px 32px" }}>
        {SAMPLE_CARDS.slice(0, 6).map((c, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PokeCard {...c} height={160} />
            <div style={{ fontSize: 11, color: "var(--ink-2)", paddingLeft: 2 }}>{c.set}</div>
          </div>
        ))}
      </div>

      {/* Browse — by vibe, made bigger and more visual */}
      <SectionHeader kicker="Browse the catalog" title="By vibe" />
      <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {VIBES.slice(0, 4).map((v) => (
          <VibeTile key={v.id} vibe={v} />
        ))}
      </div>
      <div className="pp-hscroll" style={{ padding: "0 20px 32px" }}>
        {VIBES.slice(4).map((v) => (
          <VibeTile key={v.id} vibe={v} compact />
        ))}
      </div>

      {/* Friends activity teaser */}
      <SectionHeader kicker="Your circle" title="Friends" right="See all" />
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 1 }}>
        {FRIENDS.slice(0, 4).map((f, i) => (
          <FriendRow key={i} friend={f} />
        ))}
      </div>

      {/* Surprise me — keep, but rethink */}
      <div style={{ padding: "0 20px 40px" }}>
        <button className="pp-card" style={{
          width: "100%", padding: 18, borderRadius: 18,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, oklch(50% 0.15 305) 0%, oklch(45% 0.18 340) 100%)",
          border: "1px solid var(--border-strong)",
          color: "white", cursor: "pointer", fontFamily: "inherit",
        }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Surprise me</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Random card · pulled from 18,000+</div>
          </div>
          <div style={{ fontSize: 22 }}>⚄</div>
        </button>
      </div>

      <BottomNav active="home" />
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <span><strong style={{ color: "var(--ink-0)", fontWeight: 600 }}>{n}</strong> <span style={{ color: "var(--ink-2)" }}>{label}</span></span>
  );
}

function IconBtn({ icon, badge }) {
  return (
    <button style={{
      width: 38, height: 38, borderRadius: 999,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid var(--border)",
      color: "var(--ink-0)",
      fontSize: 14,
      cursor: "pointer", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
      {badge && <span style={{
        position: "absolute", top: -2, right: -2,
        background: "var(--brand)", color: "white",
        fontSize: 9, fontWeight: 700,
        width: 16, height: 16, borderRadius: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{badge}</span>}
    </button>
  );
}

function SectionHeader({ kicker, title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 20px 14px" }}>
      <div>
        <div style={{ fontSize: 10, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>{kicker}</div>
        <div className="pp-display" style={{ fontSize: 26 }}>{title}</div>
      </div>
      {right && <button style={{
        background: "none", border: "none", color: "var(--ink-2)",
        fontSize: 12, cursor: "pointer", fontFamily: "inherit",
      }}>{right} →</button>}
    </div>
  );
}

function VibeTile({ vibe, compact = false }) {
  return (
    <div style={{
      borderRadius: 16,
      padding: compact ? 14 : 18,
      background: vibe.bg,
      color: vibe.ink,
      cursor: "pointer",
      transition: "transform 0.2s, box-shadow 0.2s",
      minHeight: compact ? 92 : 110,
      width: compact ? 150 : "100%",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ fontSize: compact ? 18 : 22 }}>{vibe.emoji}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: compact ? 14 : 16, marginBottom: 2 }}>{vibe.label}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{vibe.desc}</div>
      </div>
    </div>
  );
}

function FriendRow({ friend }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <Avatar name={friend.name} size={32} />
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.3 }}>
        <strong style={{ color: "var(--ink-0)" }}>{friend.name}</strong>{" "}
        <span style={{ color: "var(--ink-2)" }}>{friend.action}</span>{" "}
        <span style={{ color: "var(--brand-soft)" }}>{friend.card}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{friend.time}</div>
    </div>
  );
}

function BottomNav({ active = "home" }) {
  const items = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "browse", label: "Browse", icon: "▤" },
    { id: "collection", label: "Library", icon: "⊞" },
    { id: "friends", label: "Friends", icon: "◯" },
  ];
  return (
    <div style={{
      position: "sticky", bottom: 0,
      background: "rgba(10, 6, 19, 0.85)",
      backdropFilter: "blur(20px)",
      borderTop: "1px solid var(--border)",
      padding: "10px 20px 24px",
      display: "flex", justifyContent: "space-around",
    }}>
      {items.map((it) => (
        <div key={it.id} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          color: it.id === active ? "var(--brand-soft)" : "var(--ink-2)",
          fontSize: 10, cursor: "pointer", flex: 1,
        }}>
          <span style={{ fontSize: 18 }}>{it.icon}</span>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { HomeEditorial, IconBtn, SectionHeader, VibeTile, FriendRow, BottomNav, Stat });
