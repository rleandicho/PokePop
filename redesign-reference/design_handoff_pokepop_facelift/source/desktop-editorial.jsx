/* global React, PokeCard, Avatar, VIBES, SAMPLE_CARDS, FRIENDS, FriendRow */

// Desktop · editorial + activity rail
// Three-pane layout: 220px sidebar (library + vibes), main column with
// hero/recent/vibes, 320px right rail with friend activity + trending.

function DesktopEditorial({ density = "comfy" } = {}) {
  return (
    <div className="pp-bg" style={{
      width: 1280, height: 800,
      fontFamily: "var(--font-sans)",
      color: "var(--ink-0)",
      display: "grid",
      gridTemplateColumns: "220px 1fr 320px",
      gridTemplateRows: "60px 1fr",
      overflow: "hidden",
    }}>
      <div style={{
        gridColumn: "1 / -1",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,6,19,0.6)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div className="pp-display" style={{ fontSize: 22 }}>Poképop</div>
          <nav style={{ display: "flex", gap: 22, fontSize: 13, color: "var(--ink-1)" }}>
            <span style={{ color: "var(--ink-0)", fontWeight: 600 }}>Home</span>
            <span>Browse</span>
            <span>My library</span>
            <span>Friends</span>
            <span>Trades</span>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 999, padding: "6px 14px", width: 320,
            color: "var(--ink-2)", fontSize: 13,
          }}>
            <span>🔍</span><span>Search 18,000+ cards…</span>
            <span style={{
              marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10,
              padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)",
            }}>⌘K</span>
          </div>
          <Avatar name="testUser2" size={32} ring />
        </div>
      </div>

      <aside style={{
        borderRight: "1px solid var(--border)",
        padding: "20px 14px",
        background: "rgba(10,6,19,0.4)",
      }}>
        <div style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", padding: "0 10px 8px" }}>Library</div>
        <SideItem icon="⊞" label="All cards" count="9" active />
        <SideItem icon="✓" label="Owned" count="4" />
        <SideItem icon="♥" label="Wishlist" count="5" />
        <SideItem icon="◷" label="Recent" />
        <div style={{ height: 1, background: "var(--border)", margin: "16px 10px" }} />
        <div style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", padding: "0 10px 8px" }}>Vibes</div>
        {VIBES.slice(0, 6).map((v) => (
          <SideItem key={v.id} icon={v.emoji} label={v.label} dot={v.bg} />
        ))}
      </aside>

      <main className="pp-scroll" style={{ overflowY: "auto", padding: "28px 32px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
          Tuesday · April 28
        </div>
        <h1 className="pp-display" style={{ fontSize: 56, margin: 0, marginBottom: 28, lineHeight: 0.95 }}>
          Welcome back, <em>collector.</em>
        </h1>

        <div className="pp-card" style={{
          padding: 28, marginBottom: 32,
          borderRadius: 24,
          background: "linear-gradient(135deg, rgba(60,40,110,0.7), rgba(30,18,60,0.85))",
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 30% 50%, oklch(70% 0.18 305 / 0.4), transparent 60%)",
          }} />
          <div className="pp-tilt" style={{ position: "relative" }}>
            <PokeCard {...SAMPLE_CARDS[0]} height={280} />
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, color: "var(--brand-soft)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 10 }}>Featured today</div>
            <div className="pp-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>{SAMPLE_CARDS[0].name}</div>
            <div style={{ fontSize: 16, color: "var(--ink-1)", maxWidth: 460, lineHeight: 1.5, marginBottom: 20, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
              "The original holo. Where the obsession started for most of us."
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
              <span className="pp-chip">Base set</span>
              <span className="pp-chip">Holo Rare</span>
              <span className="pp-chip">12 friends own</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="pp-btn pp-btn-primary">+ Add to library</button>
              <button className="pp-btn">View on TCGplayer →</button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <h2 className="pp-display" style={{ fontSize: 28, margin: 0 }}>Continue browsing</h2>
          <span style={{ fontSize: 12, color: "var(--ink-2)" }}>Last visited 2h ago</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginBottom: 36 }}>
          {SAMPLE_CARDS.slice(0, 6).map((c, i) => (
            <PokeCard key={i} {...c} height={200} />
          ))}
        </div>

        <h2 className="pp-display" style={{ fontSize: 28, marginBottom: 14 }}>Browse by vibe</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {VIBES.map((v) => (
            <div key={v.id} style={{
              padding: 18, borderRadius: 16,
              background: v.bg, color: v.ink,
              minHeight: 110,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 22 }}>{v.emoji}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{v.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{v.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="pp-scroll" style={{
        borderLeft: "1px solid var(--border)",
        padding: "20px 18px",
        background: "rgba(10,6,19,0.4)",
        overflow: "auto",
      }}>
        <div style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pp-live-dot" /> Friend activity
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 14 }}>3 of 8 friends online</div>
        {FRIENDS.map((f, i) => <FriendRow key={i} friend={f} />)}

        <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
        <div style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>Trending in your circle</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SAMPLE_CARDS.slice(2, 5).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <PokeCard {...c} height={70} />
              <div style={{ fontSize: 12, lineHeight: 1.3 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: "var(--ink-2)", fontSize: 11 }}>{c.set} · {c.rarity}</div>
                <div style={{ color: "var(--brand-soft)", fontSize: 10, marginTop: 2 }}>+{3 + i * 2} wishlists today</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function SideItem({ icon, label, count, active, dot }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 8,
      fontSize: 13,
      color: active ? "var(--ink-0)" : "var(--ink-1)",
      background: active ? "var(--bg-card-strong)" : "transparent",
      cursor: "pointer", marginBottom: 2,
    }}>
      {dot ? (
        <span style={{ width: 12, height: 12, borderRadius: 4, background: dot, display: "inline-block" }} />
      ) : (
        <span style={{ width: 16, textAlign: "center" }}>{icon}</span>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {count && <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{count}</span>}
    </div>
  );
}
