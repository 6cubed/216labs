"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Mood = "soft" | "medium" | "bold";

const moodCopy: Record<Mood, { label: string; blurb: string }> = {
  soft: {
    label: "Soft steam",
    blurb: "Low contrast, lots of cream. Like the first bite when it’s still too hot.",
  },
  medium: {
    label: "Bistro balance",
    blurb: "Sauce and herbs in harmony — the way the photo feels.",
  },
  bold: {
    label: "Extra parmesan",
    blurb: "High contrast, sharp green accents. Parsley-forward.",
  },
};

export default function Page() {
  const [mood, setMood] = useState<Mood>("medium");

  const accent = useMemo(() => {
    if (mood === "soft") return { ring: "rgba(232, 160, 130, 0.35)", glow: "0 0 48px rgba(245, 230, 216, 0.12)" };
    if (mood === "medium") return { ring: "rgba(47, 157, 92, 0.45)", glow: "0 0 56px rgba(232, 143, 120, 0.2)" };
    return { ring: "rgba(47, 157, 92, 0.65)", glow: "0 0 64px rgba(47, 157, 92, 0.25)" };
  }, [mood]);

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "2.5rem 1.25rem 4rem",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p
          style={{
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            fontSize: "0.72rem",
            color: "var(--text-soft)",
            margin: "0 0 0.75rem",
          }}
        >
          216labs · comfort UI
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.1rem, 5vw, 2.85rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            color: "var(--cream)",
          }}
        >
          Tortellini Studio
        </h1>
        <p
          style={{
            margin: "0.85rem auto 0",
            maxWidth: 520,
            fontSize: "1.05rem",
            color: "var(--text-soft)",
            lineHeight: 1.55,
          }}
        >
          Your plate, translated into rounded corners, warm tomato-salmon tones, and a hit of parsley green — the same
          rhythm as folded pasta on a dark tray.
        </p>
      </header>

      <div
        style={{
          position: "relative",
          borderRadius: 28,
          overflow: "hidden",
          border: "1px solid rgba(255, 245, 235, 0.12)",
          boxShadow: `${accent.glow}, 0 24px 40px rgba(0,0,0,0.45)`,
          marginBottom: "2rem",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(105deg, transparent 35%, rgba(255,248,240,0.18) 48%, transparent 62%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "var(--tray)" }}>
          <Image
            src="/hero.png"
            alt="Plate of tortellini in creamy tomato sauce with parmesan and parsley"
            fill
            sizes="(max-width: 960px) 100vw, 960px"
            priority
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>

      <section
        aria-label="Palette"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        {[
          { name: "Tomato cream", hex: "#E08F78" },
          { name: "Deep sauce", hex: "#C96B52" },
          { name: "Parmesan", hex: "#FFF8F0" },
          { name: "Parsley", hex: "#2F9D5C" },
          { name: "Tray", hex: "#0E0E10" },
        ].map((sw) => (
          <div
            key={sw.hex}
            style={{
              borderRadius: 18,
              padding: "0.75rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,245,235,0.08)",
            }}
          >
            <div
              style={{
                height: 56,
                borderRadius: 14,
                background: sw.hex,
                marginBottom: "0.5rem",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
              }}
            />
            <div style={{ fontSize: "0.78rem", color: "var(--text-soft)" }}>{sw.name}</div>
            <div style={{ fontSize: "0.72rem", opacity: 0.6 }}>{sw.hex}</div>
          </div>
        ))}
      </section>

      <section
        style={{
          borderRadius: 24,
          padding: "1.5rem",
          background: "linear-gradient(145deg, rgba(224, 143, 120, 0.12) 0%, rgba(14, 14, 16, 0.9) 55%)",
          border: `1px solid ${accent.ring}`,
          boxShadow: "0 16px 32px rgba(0,0,0,0.35)",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", color: "var(--cream)" }}>Comfort dial</h2>
        <p style={{ margin: "0 0 1rem", color: "var(--text-soft)", fontSize: "0.95rem", lineHeight: 1.5 }}>
          Pick a mood — we shift the glow and border. No database, no tracking: just the vibe of the meal.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.25rem" }}>
          {(["soft", "medium", "bold"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(m)}
              style={{
                flex: "1 1 120px",
                cursor: "pointer",
                borderRadius: 999,
                border: mood === m ? "2px solid var(--herb)" : "1px solid rgba(255,245,235,0.2)",
                padding: "0.65rem 1rem",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "inherit",
                color: mood === m ? "var(--cream)" : "var(--text-soft)",
                background:
                  mood === m ? "linear-gradient(180deg, rgba(47,157,92,0.35), rgba(14,14,16,0.6))" : "rgba(0,0,0,0.25)",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              {moodCopy[m].label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.55, color: "var(--cream-muted)" }}>{moodCopy[mood].blurb}</p>
      </section>

      <footer
        style={{
          marginTop: "2.5rem",
          textAlign: "center",
          fontSize: "0.85rem",
          color: "var(--text-soft)",
        }}
      >
        Folded pasta. Folded corners. ·{" "}
        <span style={{ color: "var(--sauce)" }}>tortellini.6cubed.app</span>
      </footer>
    </main>
  );
}
