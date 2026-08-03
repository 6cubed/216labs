"use client";

import { useEffect, useState } from "react";
import { INTERESTS, storymagicPreorderUrl, storymagicUrl, type Budget, type GiftIdea } from "@/lib/gifts";
import { trackKidgiftEvent } from "@/lib/analytics";

type CheckoutReady = {
  preorderConfigured?: boolean;
  preorderUrl?: string;
  priceUsd?: string;
  waitlistCount?: number;
};

type SuggestResponse = {
  ok: boolean;
  gifts: GiftIdea[];
  storymagic: GiftIdea;
  source: "curated" | "openai";
};

export default function Page() {
  const [age, setAge] = useState(7);
  const [interests, setInterests] = useState<string[]>(["books"]);
  const [budget, setBudget] = useState<Budget>("25to50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [checkout, setCheckout] = useState<CheckoutReady | null>(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState("");
  const [waitlistSaving, setWaitlistSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://storybook.6cubed.app/api/checkout/ready")
      .then((r) => r.json())
      .then((data: CheckoutReady) => {
        if (cancelled) return;
        setCheckout(data);
        setWaitlistCount(typeof data.waitlistCount === "number" ? data.waitlistCount : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleInterest(id: string) {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 6)
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, interests, budget }),
      });
      const data = (await res.json()) as SuggestResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const smUrl = storymagicUrl(age, interests);
  const preorderLive = Boolean(checkout?.preorderConfigured && checkout.preorderUrl?.trim());
  const smCtaUrl = preorderLive
    ? storymagicPreorderUrl(checkout!.preorderUrl!.trim(), age, interests)
    : smUrl;
  const smCtaLabel = preorderLive
    ? `Preorder hardcover — $${checkout?.priceUsd ?? "24.99"}`
    : "Create free preview →";

  async function onWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = waitlistEmail.trim();
    if (!email) return;
    setWaitlistSaving(true);
    setWaitlistStatus("");
    try {
      const res = await fetch("https://storybook.6cubed.app/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          utm_source: "kidgift",
          utm_medium: "results_waitlist",
          utm_campaign: "gift_finder",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      trackKidgiftEvent("waitlist_signup", {
        placement: "kidgift_results",
        utm_source: "kidgift",
        utm_campaign: "gift_finder",
      });
      setWaitlistStatus("You’re on the list — we’ll email when StoryMagic preorders open.");
      setWaitlistEmail("");
      setWaitlistCount((n) => n + 1);
    } catch (err) {
      setWaitlistStatus(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWaitlistSaving(false);
    }
  }

  function onStorymagicCtaClick() {
    trackKidgiftEvent(preorderLive ? "preorder_click" : "storymagic_cta_click", {
      placement: "kidgift_premium_pick",
      child_age: age,
    });
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem 3rem" }}>
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p style={{ fontSize: "2rem", margin: "0 0 0.25rem" }}>🎁</p>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.5rem", color: "var(--purple)" }}>
          KidGift
        </h1>
        <p style={{ color: "var(--muted)", margin: 0, maxWidth: 420, marginInline: "auto" }}>
          Gift ideas for kids by age and interests — instant curated picks, optional AI polish.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "1.5rem",
          boxShadow: "0 8px 30px rgba(124,58,237,0.08)",
          border: "1px solid var(--purple-light)",
        }}
      >
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
          Age: <span style={{ color: "var(--purple)" }}>{age}</span>
        </label>
        <input
          type="range"
          min={1}
          max={12}
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          style={{ marginBottom: "1.25rem" }}
        />

        <p style={{ fontWeight: 600, marginBottom: 8 }}>Interests</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1.25rem" }}>
          {INTERESTS.map((item) => {
            const on = interests.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleInterest(item.id)}
                style={{
                  border: on ? "2px solid var(--purple)" : "2px solid #e2e8f0",
                  background: on ? "var(--purple-light)" : "#fff",
                  borderRadius: 999,
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.85rem",
                }}
              >
                {item.emoji} {item.label}
              </button>
            );
          })}
        </div>

        <p style={{ fontWeight: 600, marginBottom: 8 }}>Budget</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1.25rem" }}>
          {(
            [
              ["under25", "Under $25"],
              ["25to50", "$25–50"],
              ["50plus", "$50+"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBudget(id)}
              style={{
                border: budget === id ? "2px solid var(--purple)" : "2px solid #e2e8f0",
                background: budget === id ? "var(--purple-light)" : "#fff",
                borderRadius: 10,
                padding: "0.5rem 0.85rem",
                fontSize: "0.9rem",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || interests.length === 0}
          style={{
            width: "100%",
            padding: "0.85rem",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(90deg, var(--purple), var(--pink))",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1rem",
            opacity: loading || interests.length === 0 ? 0.6 : 1,
          }}
        >
          {loading ? "Finding gifts…" : "Find gift ideas"}
        </button>
        {interests.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 8 }}>
            Pick at least one interest.
          </p>
        ) : null}
        {error ? <p style={{ color: "#dc2626", marginTop: 8, fontSize: "0.9rem" }}>{error}</p> : null}
      </form>

      {result ? (
        <section style={{ marginTop: "2rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
            {result.source === "openai" ? "AI suggestions" : "Curated picks"} for age {age}
          </p>

          <div
            style={{
              background: "linear-gradient(135deg, var(--purple), var(--pink))",
              color: "#fff",
              borderRadius: 16,
              padding: "1.25rem",
              marginBottom: "1rem",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>
              Premium pick · {result.storymagic.tag}
            </p>
            <h2 style={{ margin: "0.35rem 0", fontSize: "1.25rem" }}>{result.storymagic.name}</h2>
            <p style={{ margin: "0 0 0.75rem", opacity: 0.95, fontSize: "0.95rem" }}>{result.storymagic.why}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{result.storymagic.priceHint}</span>
              <a
                href={smCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onStorymagicCtaClick}
                style={{
                  background: "#fff",
                  color: "var(--purple)",
                  padding: "0.5rem 1rem",
                  borderRadius: 10,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                {smCtaLabel}
                {!preorderLive && waitlistCount >= 1
                  ? ` · ${waitlistCount} ${waitlistCount === 1 ? "family" : "families"} waiting`
                  : ""}
              </a>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.gifts.map((g) => (
              <article
                key={g.name}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "1rem 1.15rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{g.name}</h3>
                  {g.tag ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        background: "var(--purple-light)",
                        color: "var(--purple)",
                        padding: "0.15rem 0.5rem",
                        borderRadius: 999,
                        alignSelf: "start",
                      }}
                    >
                      {g.tag}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: "0.4rem 0", color: "var(--muted)", fontSize: "0.92rem" }}>{g.why}</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}>{g.priceHint}</p>
              </article>
            ))}
          </div>

          {!preorderLive ? (
            <form
              onSubmit={onWaitlistSubmit}
              style={{
                marginTop: "1.5rem",
                background: "#fff",
                borderRadius: 14,
                padding: "1rem 1.15rem",
                border: "1px solid var(--purple-light)",
              }}
            >
              <p style={{ margin: "0 0 0.75rem", fontWeight: 600, fontSize: "0.95rem" }}>
                Not ready for a preview? Get emailed when printed books go on sale
                {waitlistCount >= 1
                  ? ` — ${waitlistCount} ${waitlistCount === 1 ? "family" : "families"} already waiting`
                  : ""}
                .
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  style={{
                    flex: "1 1 200px",
                    padding: "0.6rem 0.75rem",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontSize: "0.95rem",
                  }}
                />
                <button
                  type="submit"
                  disabled={waitlistSaving}
                  style={{
                    padding: "0.6rem 1rem",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--purple)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    opacity: waitlistSaving ? 0.7 : 1,
                  }}
                >
                  {waitlistSaving ? "Saving…" : "Join waitlist"}
                </button>
              </div>
              {waitlistStatus ? (
                <p
                  style={{
                    margin: "0.75rem 0 0",
                    fontSize: "0.85rem",
                    color: waitlistStatus.startsWith("You") ? "#059669" : "#dc2626",
                  }}
                >
                  {waitlistStatus}
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : null}

      <footer style={{ textAlign: "center", marginTop: "2.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
        <p style={{ margin: 0 }}>
          KidGift by{" "}
          <a href="https://6cubed.app" style={{ color: "var(--purple)" }}>
            216labs
          </a>
          {" · "}
          <a href={smUrl} style={{ color: "var(--purple)" }}>
            StoryMagic
          </a>
        </p>
      </footer>
    </main>
  );
}
