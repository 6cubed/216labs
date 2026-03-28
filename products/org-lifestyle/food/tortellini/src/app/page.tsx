"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Mood = "soft" | "medium" | "bold";
type Dish = "tortellini" | "gamberoni";

const TORTELLINI_MOOD: Record<Mood, { label: string; blurb: string }> = {
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

const GAMBERONI_MOOD: Record<Mood, { label: string; blurb: string }> = {
  soft: {
    label: "Harbour calm",
    blurb: "Pale pasta, gentle oil shine — prawns barely peeking through.",
  },
  medium: {
    label: "Tomato & chili",
    blurb: "Cherry halves, a ring of heat, cheese and bottarga doing the talking.",
  },
  bold: {
    label: "Bottarga forward",
    blurb: "Orange roe dust, poppy-red heat, black tray — maximum contrast.",
  },
};

const DISH_META: Record<
  Dish,
  {
    name: string;
    intro: string;
    hero: string;
    heroAlt: string;
    swatches: { name: string; hex: string }[];
    overlay: string;
    comfortCardBg: string;
    moodCopy: Record<Mood, { label: string; blurb: string }>;
  }
> = {
  tortellini: {
    name: "Tortellini",
    intro:
      "Folded pasta on a dark tray: tomato-cream sauce, parmesan stripe, parsley flecks — translated into rounded corners and soft glow.",
    hero: "/hero.png",
    heroAlt: "Plate of tortellini in creamy tomato sauce with parmesan and parsley",
    swatches: [
      { name: "Tomato cream", hex: "#E08F78" },
      { name: "Deep sauce", hex: "#C96B52" },
      { name: "Parmesan", hex: "#FFF8F0" },
      { name: "Parsley", hex: "#2F9D5C" },
      { name: "Tray", hex: "#0E0E10" },
    ],
    overlay: "linear-gradient(105deg, transparent 35%, rgba(255,248,240,0.18) 48%, transparent 62%)",
    comfortCardBg: "linear-gradient(145deg, rgba(224, 143, 120, 0.12) 0%, rgba(14, 14, 16, 0.9) 55%)",
    moodCopy: TORTELLINI_MOOD,
  },
  gamberoni: {
    name: "Spaghetti gamberoni",
    intro:
      "Long spaghetti, prawns, cherry tomatoes and chili on a white oval plate — cheese, bottarga dust, wood table and black tray. Bright, coastal, a little heat.",
    hero: "/gamberoni.png",
    heroAlt: "Spaghetti gamberoni with shrimp, cherry tomatoes, chili, cheese and bottarga on a white plate",
    swatches: [
      { name: "Pasta wheat", hex: "#E8D5B0" },
      { name: "Poppy tomato", hex: "#D62839" },
      { name: "Bottarga", hex: "#E8943E" },
      { name: "Oak wood", hex: "#C4A574" },
      { name: "Tray", hex: "#141416" },
    ],
    overlay: "linear-gradient(118deg, transparent 30%, rgba(232, 148, 62, 0.12) 50%, transparent 68%)",
    comfortCardBg: "linear-gradient(145deg, rgba(214, 40, 57, 0.1) 0%, rgba(20, 20, 22, 0.92) 50%)",
    moodCopy: GAMBERONI_MOOD,
  },
};

function accentFor(dish: Dish, mood: Mood): { ring: string; glow: string } {
  if (dish === "tortellini") {
    if (mood === "soft") return { ring: "rgba(232, 160, 130, 0.35)", glow: "0 0 48px rgba(245, 230, 216, 0.12)" };
    if (mood === "medium") return { ring: "rgba(47, 157, 92, 0.45)", glow: "0 0 56px rgba(232, 143, 120, 0.2)" };
    return { ring: "rgba(47, 157, 92, 0.65)", glow: "0 0 64px rgba(47, 157, 92, 0.25)" };
  }
  if (mood === "soft") return { ring: "rgba(232, 213, 176, 0.35)", glow: "0 0 52px rgba(196, 165, 116, 0.15)" };
  if (mood === "medium") return { ring: "rgba(214, 40, 57, 0.45)", glow: "0 0 58px rgba(232, 148, 62, 0.22)" };
  return { ring: "rgba(232, 148, 62, 0.55)", glow: "0 0 64px rgba(214, 40, 57, 0.2)" };
}

function activeBtnBorder(dish: Dish, mood: Mood, selected: boolean): string {
  if (!selected) return "1px solid rgba(255,245,235,0.2)";
  if (dish === "tortellini") return "2px solid #2F9D5C";
  return mood === "soft" ? "2px solid #C4A574" : mood === "medium" ? "2px solid #D62839" : "2px solid #E8943E";
}

function activeBtnBg(dish: Dish, mood: Mood, selected: boolean): string {
  if (!selected) return "rgba(0,0,0,0.25)";
  if (dish === "tortellini") return "linear-gradient(180deg, rgba(47,157,92,0.35), rgba(14,14,16,0.6))";
  if (mood === "soft") return "linear-gradient(180deg, rgba(196,165,116,0.3), rgba(14,14,16,0.65))";
  if (mood === "medium") return "linear-gradient(180deg, rgba(214,40,57,0.25), rgba(14,14,16,0.65))";
  return "linear-gradient(180deg, rgba(232,148,62,0.3), rgba(14,14,16,0.65))";
}

export default function Page() {
  const [dish, setDish] = useState<Dish>("tortellini");
  const [mood, setMood] = useState<Mood>("medium");
  const meta = DISH_META[dish];

  const accent = useMemo(() => accentFor(dish, mood), [dish, mood]);

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "2.5rem 1.25rem 4rem",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
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
        <p style={{ margin: "0.6rem 0 0", fontSize: "0.95rem", color: "var(--text-soft)" }}>Two plates, two palettes</p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
        role="tablist"
        aria-label="Choose dish"
      >
        {(["tortellini", "gamberoni"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={dish === d}
            onClick={() => setDish(d)}
            style={{
              cursor: "pointer",
              borderRadius: 999,
              border: dish === d ? "2px solid var(--sauce)" : "1px solid rgba(255,245,235,0.2)",
              padding: "0.55rem 1.15rem",
              fontWeight: 700,
              fontSize: "0.88rem",
              fontFamily: "inherit",
              color: dish === d ? "var(--cream)" : "var(--text-soft)",
              background: dish === d ? "rgba(224, 143, 120, 0.2)" : "rgba(0,0,0,0.2)",
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            {d === "tortellini" ? "Tortellini" : "Spaghetti gamberoni"}
          </button>
        ))}
      </div>

      <p
        style={{
          margin: "0 auto 1.75rem",
          maxWidth: 540,
          textAlign: "center",
          fontSize: "1.05rem",
          color: "var(--text-soft)",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--cream)" }}>{meta.name}</strong>
        <br />
        {meta.intro}
      </p>

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
            background: meta.overlay,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "var(--tray)" }}>
          <Image
            src={meta.hero}
            alt={meta.heroAlt}
            fill
            sizes="(max-width: 960px) 100vw, 960px"
            priority={dish === "tortellini"}
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
        {meta.swatches.map((sw) => (
          <div
            key={`${dish}-${sw.hex}`}
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
          background: meta.comfortCardBg,
          border: `1px solid ${accent.ring}`,
          boxShadow: "0 16px 32px rgba(0,0,0,0.35)",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", color: "var(--cream)" }}>Comfort dial</h2>
        <p style={{ margin: "0 0 1rem", color: "var(--text-soft)", fontSize: "0.95rem", lineHeight: 1.5 }}>
          Pick a mood — glow and border follow the plate. Still no database, no tracking.
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
                border: activeBtnBorder(dish, mood, mood === m),
                padding: "0.65rem 1rem",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "inherit",
                color: mood === m ? "var(--cream)" : "var(--text-soft)",
                background: activeBtnBg(dish, mood, mood === m),
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              {meta.moodCopy[m].label}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.55, color: "var(--cream-muted)" }}>
          {meta.moodCopy[mood].blurb}
        </p>
      </section>

      <footer
        style={{
          marginTop: "2.5rem",
          textAlign: "center",
          fontSize: "0.85rem",
          color: "var(--text-soft)",
        }}
      >
        Two plates, one studio. · <span style={{ color: "var(--sauce)" }}>tortellini.6cubed.app</span>
      </footer>
    </main>
  );
}
