"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Sparkles,
  Loader2,
  ShoppingCart,
  Star,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Share2,
} from "lucide-react";
import BookViewer, { BookPage } from "@/components/BookViewer";
import { trackStorybookEvent } from "@/lib/analytics";
import { appendUtmToPaymentUrl, captureUtmFromUrl, getStoredRefBook, getStoredUtm } from "@/lib/utm";

type Step = "form" | "generating" | "preview";

interface GenerateResponse {
  bookId: string;
  title: string;
  subtitle: string;
  characterDescription: string;
  pages: Array<{ pageNumber: number; text: string; imagePrompt: string }>;
}

interface GenerationProgress {
  label: string;
  done: boolean;
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("form");
  const [age, setAge] = useState(5);
  const [topic, setTopic] = useState("");
  const [childName, setChildName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookSubtitle, setBookSubtitle] = useState("");
  const [pages, setPages] = useState<BookPage[]>([]);
  const [progressSteps, setProgressSteps] = useState<GenerationProgress[]>([]);
  const [checkoutReady, setCheckoutReady] = useState<boolean | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutSetupUrl, setCheckoutSetupUrl] = useState<string | null>(null);
  const [bookPriceUsd, setBookPriceUsd] = useState("24.99");
  const [interestEmail, setInterestEmail] = useState("");
  const [interestSent, setInterestSent] = useState(false);
  const [interestLoading, setInterestLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [preorderUrl, setPreorderUrl] = useState("");
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [friendReferral, setFriendReferral] = useState(false);
  const [quickEmail, setQuickEmail] = useState("");
  const [quickWaitlistSent, setQuickWaitlistSent] = useState(false);
  const [quickWaitlistLoading, setQuickWaitlistLoading] = useState(false);

  useEffect(() => {
    captureUtmFromUrl();
    const ref = getStoredRefBook();
    if (ref) {
      setFriendReferral(true);
      trackStorybookEvent("referral_landing", { ref_book: ref });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/checkout/ready");
        const data = (await res.json()) as {
          ready: boolean;
          message?: string;
          priceUsd?: string;
          setupUrl?: string;
          preorderUrl?: string;
          waitlistCount?: number;
        };
        if (!cancelled) {
          setCheckoutReady(data.ready);
          setCheckoutMessage(data.message ?? null);
          setCheckoutSetupUrl(data.setupUrl ?? null);
          if (data.priceUsd) setBookPriceUsd(data.priceUsd);
          setPreorderUrl(data.preorderUrl?.trim() ?? "");
          setWaitlistCount(typeof data.waitlistCount === "number" ? data.waitlistCount : 0);
        }
      } catch {
        if (!cancelled) setCheckoutReady(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setError(null);
    trackStorybookEvent("generate_start", { child_age: age });
    setStep("generating");
    setPages([]);
    setProgressSteps([
      { label: "Writing your story…", done: false },
    ]);

    try {
      // Step 1: Generate story text
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, topic: topic.trim(), childName: childName.trim() }),
      });

      if (!genRes.ok) {
        const err = (await genRes.json()) as { error: string };
        throw new Error(err.error ?? "Failed to generate story");
      }

      const genData = (await genRes.json()) as GenerateResponse;

      setBookId(genData.bookId);
      setBookTitle(genData.title);
      setBookSubtitle(genData.subtitle);

      setProgressSteps([
        { label: "Writing your story…", done: true },
        ...genData.pages.map((p) => ({
          label: `Illustrating page ${p.pageNumber}…`,
          done: false,
        })),
      ]);

      // Initialise pages with loading state
      const initialPages: BookPage[] = genData.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        imagePrompt: p.imagePrompt,
        imageUrl: null,
        loading: true,
      }));
      setPages(initialPages);

      // Step 2: Illustrate each page sequentially
      for (let i = 0; i < genData.pages.length; i++) {
        const page = genData.pages[i];

        const illRes = await fetch("/api/illustrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imagePrompt: page.imagePrompt,
            characterDescription: genData.characterDescription,
            age,
          }),
        });

        if (illRes.ok) {
          const illData = (await illRes.json()) as { imageUrl: string };
          setPages((prev) =>
            prev.map((p) =>
              p.pageNumber === page.pageNumber
                ? { ...p, imageUrl: illData.imageUrl, loading: false }
                : p
            )
          );
        } else {
          setPages((prev) =>
            prev.map((p) =>
              p.pageNumber === page.pageNumber ? { ...p, loading: false } : p
            )
          );
        }

        setProgressSteps((prev) =>
          prev.map((s, idx) => (idx === i + 1 ? { ...s, done: true } : s))
        );
      }

      setStep("preview");
      trackStorybookEvent("story_preview_ready", {
        book_id: genData.bookId,
        page_count: genData.pages.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStep("form");
    }
  }

  async function handlePrintInterest() {
    if (!bookId || !interestEmail.trim()) return;
    setInterestLoading(true);
    setError(null);
    try {
      const utm = getStoredUtm();
      const res = await fetch("/api/print-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          email: interestEmail.trim(),
          ...utm,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save your email");
      }
      setInterestSent(true);
      setWaitlistCount((n) => n + 1);
      trackStorybookEvent("waitlist_signup", { book_id: bookId, ...utm });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setInterestLoading(false);
    }
  }

  async function handleQuickWaitlistSubmit() {
    if (!quickEmail.trim()) return;
    setQuickWaitlistLoading(true);
    setError(null);
    try {
      const utm = getStoredUtm();
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: quickEmail.trim(),
          utm_source: utm.utm_source ?? "storybook",
          utm_medium: utm.utm_medium ?? "hero_waitlist",
          utm_campaign: utm.utm_campaign ?? "email_only",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save your email");
      }
      setQuickWaitlistSent(true);
      setWaitlistCount((n) => n + 1);
      trackStorybookEvent("waitlist_signup", { placement: "hero_email_only", ...utm });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setQuickWaitlistLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (typeof window === "undefined") return;
    const base = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = bookId
      ? `${base}?utm_source=share&utm_medium=referral&utm_campaign=storymagic_friend&ref_book=${encodeURIComponent(bookId)}`
      : `${base}?utm_source=share&utm_medium=referral&utm_campaign=storymagic_friend`;
    const shareText = childName
      ? `StoryMagic — a personalised AI storybook starring ${childName}`
      : "StoryMagic — free AI preview of a personalised kids book";
    try {
      if (navigator.share) {
        await navigator.share({ title: "StoryMagic", text: shareText, url: shareUrl });
        trackStorybookEvent("share_link_copy", { book_id: bookId ?? "", method: "web_share" });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      trackStorybookEvent("share_link_copy", { book_id: bookId ?? "", method: "clipboard" });
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      if (!navigator.share) {
        setError("Could not copy link — try sharing the URL from your browser bar.");
      }
    }
  }

  async function handleOrder() {
    if (!bookId) return;
    setIsOrdering(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed");
      }

      trackStorybookEvent("begin_checkout", { book_id: bookId });
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      setError(msg);
      setIsOrdering(false);
    }
  }

  function openPreorder(placement: string) {
    if (!preorderUrl) return;
    const utm = getStoredUtm();
    trackStorybookEvent("preorder_click", { book_id: bookId ?? "", placement, ...utm });
    const url = appendUtmToPaymentUrl(preorderUrl, utm, bookId ?? undefined);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleReset() {
    setStep("form");
    setPages([]);
    setBookId(null);
    setBookTitle("");
    setBookSubtitle("");
    setError(null);
    setProgressSteps([]);
  }

  return (
    <main className="min-h-screen">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-story-purple via-purple-600 to-story-pink py-16 px-6 text-center text-white">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-story-yellow/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-story-yellow" />
            <h1 className="text-5xl font-display font-bold tracking-tight">
              StoryMagic
            </h1>
            <Sparkles className="w-8 h-8 text-story-yellow" />
          </div>
          <p className="text-xl text-white/80 mb-2">
            Turn any idea into a beautiful, illustrated children&apos;s book
          </p>
          <p className="text-white/60 text-sm">
            Powered by AI · Printed hardcover from ${bookPriceUsd} · Delivered to your door
          </p>
          {preorderUrl && checkoutReady !== true ? (
            <button
              type="button"
              onClick={() => openPreorder("hero")}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-story-purple font-bold text-sm shadow-lg hover:bg-story-yellow-light transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Preorder printed book — ${bookPriceUsd}
            </button>
          ) : checkoutReady !== true && !quickWaitlistSent ? (
            <div className="mt-6 max-w-md mx-auto">
              <p className="text-white/75 text-sm mb-2">
                Get emailed when printed books go on sale
                {waitlistCount >= 1
                  ? ` · ${waitlistCount} ${waitlistCount === 1 ? "family" : "families"} waiting`
                  : ""}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="flex-1 px-4 py-2.5 rounded-xl border-0 text-gray-800 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-story-yellow"
                />
                <button
                  type="button"
                  onClick={() => void handleQuickWaitlistSubmit()}
                  disabled={quickWaitlistLoading || !quickEmail.trim()}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-story-yellow text-story-purple shadow-md hover:bg-story-yellow-light disabled:opacity-50 whitespace-nowrap"
                >
                  {quickWaitlistLoading ? "Saving…" : "Join waitlist"}
                </button>
              </div>
            </div>
          ) : checkoutReady !== true && quickWaitlistSent ? (
            <p className="mt-5 text-white/90 text-sm font-medium">
              You&apos;re on the list — we&apos;ll email when checkout opens.
            </p>
          ) : null}
          {waitlistCount >= 1 ? (
            <p className="mt-4 text-white/70 text-xs">
              {waitlistCount === 1
                ? "1 family on the print waitlist"
                : `${waitlistCount} families on the print waitlist`}
              {preorderUrl && checkoutReady !== true ? " — or preorder now above" : ""}
            </p>
          ) : null}
        </motion.div>

        {/* Stars row */}
        <div className="relative z-10 flex items-center justify-center gap-1 mt-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-story-yellow text-story-yellow" />
          ))}
          <span className="text-white/60 text-sm ml-2">AI-generated illustrations</span>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {friendReferral && step === "form" ? (
          <div className="mb-6 rounded-2xl border border-story-purple/30 bg-story-purple-light/80 px-4 py-3 text-center text-sm text-story-dark">
            A friend shared their StoryMagic book — create a personalised story for your child below.
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          {/* ── Form ── */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-story-purple-light">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-story-purple-light rounded-xl flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-story-purple" />
                  </div>
                  <h2 className="text-2xl font-bold text-story-dark">Create your story</h2>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                  {/* Child's age */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Child&apos;s age
                      <span className="ml-2 text-story-purple font-bold text-base">
                        {age} year{age !== 1 ? "s" : ""} old
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-story-purple"
                        style={{
                          background: `linear-gradient(to right, #7C3AED ${((age - 1) / 11) * 100}%, #EDE9FE ${((age - 1) / 11) * 100}%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>1</span>
                        <span>6</span>
                        <span>12</span>
                      </div>
                    </div>

                    {/* Age group hint */}
                    <p className="text-xs text-gray-400 mt-2">
                      {age <= 3
                        ? "Very simple sentences, big concepts"
                        : age <= 6
                        ? "Short, clear sentences with a fun adventure"
                        : age <= 9
                        ? "Longer story with a clear moral lesson"
                        : "Richer vocabulary, more complex plot"}
                    </p>
                  </div>

                  {/* Story topic */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Story idea or topic{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. A little dragon who is afraid of fire, a bunny who wants to go to the moon, a brave princess who makes friends with a giant…"
                      rows={3}
                      required
                      className="w-full px-4 py-3 rounded-2xl border-2 border-story-purple-light focus:border-story-purple focus:outline-none resize-none text-gray-700 placeholder-gray-300 transition-colors"
                    />
                  </div>

                  {/* Child's name (optional) */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Child&apos;s name{" "}
                      <span className="text-gray-400 font-normal">(optional — becomes the hero!)</span>
                    </label>
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g. Emma, Theo, Lily…"
                      maxLength={30}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-story-purple-light focus:border-story-purple focus:outline-none text-gray-700 placeholder-gray-300 transition-colors"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!topic.trim()}
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-story-purple to-story-pink text-white
                      hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      flex items-center justify-center gap-3 shadow-lg shadow-story-purple/25"
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate My Storybook
                  </button>

                  {preorderUrl && checkoutReady !== true ? (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 text-center mb-2">
                        Already know you want the printed book?
                      </p>
                      <button
                        type="button"
                        onClick={() => openPreorder("form")}
                        className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-story-purple text-story-purple
                          hover:bg-story-purple-light transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Preorder hardcover — ${bookPriceUsd}
                      </button>
                    </div>
                  ) : null}

                  {checkoutReady !== true && !quickWaitlistSent ? (
                    <div className="pt-4 mt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 text-center mb-2">
                        Not ready to generate? Get emailed when print checkout opens
                        {waitlistCount >= 1 ? ` · ${waitlistCount} families waiting` : ""}.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={quickEmail}
                          onChange={(e) => setQuickEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          autoComplete="email"
                          className="flex-1 px-4 py-3 rounded-xl border-2 border-story-purple-light focus:border-story-purple focus:outline-none text-gray-700 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handleQuickWaitlistSubmit()}
                          disabled={quickWaitlistLoading || !quickEmail.trim()}
                          className="px-5 py-3 rounded-xl font-semibold text-sm bg-story-purple-light text-story-purple
                            hover:bg-story-purple/15 disabled:opacity-50 whitespace-nowrap"
                        >
                          {quickWaitlistLoading ? "Saving…" : "Notify me"}
                        </button>
                      </div>
                    </div>
                  ) : checkoutReady !== true && quickWaitlistSent ? (
                    <p className="pt-4 mt-2 border-t border-gray-100 text-sm text-center text-story-purple font-medium">
                      You&apos;re on the list — we&apos;ll email when printed checkout is live.
                    </p>
                  ) : null}
                </form>
              </div>

              {/* How it works */}
              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  { emoji: "✍️", title: "You describe", desc: "Age, idea, and the child's name" },
                  { emoji: "🤖", title: "AI creates", desc: "Story + 6 unique illustrations" },
                  { emoji: "📦", title: "We print", desc: "Premium hardback to your door" },
                ].map(({ emoji, title, desc }) => (
                  <div key={title} className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
                    <div className="text-3xl mb-2">{emoji}</div>
                    <p className="font-semibold text-story-dark text-sm">{title}</p>
                    <p className="text-xs text-gray-400 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Generating ── */}
          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="bg-white rounded-3xl shadow-xl p-10 border border-story-purple-light">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-story-purple to-story-pink rounded-full flex items-center justify-center"
                >
                  <BookOpen className="w-10 h-10 text-white" />
                </motion.div>

                <h2 className="text-2xl font-bold text-story-dark mb-2">
                  Creating your magical story…
                </h2>
                <p className="text-gray-500 mb-8">
                  This takes about 2–3 minutes. Each illustration is made just for your story.
                </p>

                <div className="space-y-3 text-left max-w-xs mx-auto">
                  {progressSteps.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      {s.done ? (
                        <CheckCircle2 className="w-5 h-5 text-story-teal flex-shrink-0" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-story-purple animate-spin flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm ${s.done ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
                      >
                        {s.label}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Live page previews while generating */}
                {pages.length > 0 && (
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {pages.map((page) => (
                      <div
                        key={page.pageNumber}
                        className="aspect-square rounded-xl overflow-hidden bg-story-purple-light relative"
                      >
                        {page.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={page.imageUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="shimmer absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-story-purple animate-spin" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-white/80 text-story-purple text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {page.pageNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Preview ── */}
          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Heading */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-story-teal-light text-story-teal px-4 py-2 rounded-full text-sm font-semibold mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  Your story is ready!
                </div>
                <h2 className="text-3xl font-display font-bold text-story-dark">
                  {bookTitle}
                </h2>
                <p className="text-gray-500 italic mt-1">{bookSubtitle}</p>
              </div>

              {/* Book viewer */}
              <BookViewer
                title={bookTitle}
                subtitle={bookSubtitle}
                childName={childName}
                pages={pages}
              />

              {/* Order CTA */}
              <div className="mt-10 bg-gradient-to-br from-story-purple to-story-pink rounded-3xl p-8 text-white text-center">
                <h3 className="text-2xl font-bold mb-2">Love it? Print it! 📚</h3>
                <p className="text-story-yellow-light text-lg font-semibold mb-2">
                  Hardback · ${bookPriceUsd} USD
                </p>
                <p className="text-white/80 mb-6">
                  Order a professionally printed, full-colour book delivered to your door.
                  Makes a perfect gift.
                </p>

                <div className="flex items-center justify-center gap-6 mb-6 text-sm">
                  {["Premium print quality", "Tracked shipping", "7–10 business days"].map(
                    (item) => (
                      <div key={item} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-story-yellow" />
                        <span className="text-white/90">{item}</span>
                      </div>
                    )
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl p-3 mb-4 text-white/90 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {checkoutReady === false && checkoutMessage && (
                  <div className="flex items-start gap-2 bg-amber-500/15 border border-amber-400/30 rounded-xl p-3 mb-4 text-white/90 text-sm text-left max-w-lg mx-auto">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {checkoutMessage}
                      {checkoutSetupUrl && (
                        <>
                          {" "}
                          <a
                            href={checkoutSetupUrl}
                            className="underline font-semibold text-story-yellow-light"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Add Stripe keys in admin
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                )}

                {checkoutReady !== true && !interestSent && (
                  <div className="mb-6 max-w-lg mx-auto">
                    {preorderUrl ? (
                      <div className="mb-5">
                        <p className="text-white text-base mb-3 font-semibold">
                          Love this story? Order the printed hardcover now.
                        </p>
                        <button
                          type="button"
                          onClick={() => openPreorder("preview")}
                          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white text-story-purple font-bold text-lg shadow-lg hover:bg-story-yellow-light transition-colors"
                        >
                          <ShoppingCart className="w-5 h-5" />
                          Preorder now — ${bookPriceUsd}
                        </button>
                        <p className="text-white/55 text-xs mt-2 text-center">
                          Secure Stripe payment · Ships when checkout is fully automated
                        </p>
                      </div>
                    ) : (
                      <p className="text-white text-base mb-4 font-semibold">
                        Reserve your printed book — we&apos;ll email you when checkout opens.
                        {waitlistCount >= 2 ? (
                          <span className="block text-white/70 text-sm font-normal mt-1">
                            Join {waitlistCount}+ families already on the waitlist.
                          </span>
                        ) : null}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={interestEmail}
                        onChange={(e) => setInterestEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="flex-1 px-4 py-3.5 rounded-xl text-gray-900 text-base border-0 shadow-md"
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        onClick={handlePrintInterest}
                        disabled={interestLoading || !interestEmail.trim()}
                        className="px-8 py-3.5 bg-story-yellow text-story-purple rounded-xl font-bold text-base
                          hover:bg-story-yellow-light disabled:opacity-60 whitespace-nowrap shadow-lg"
                      >
                        {interestLoading ? "Saving…" : "Join the waitlist"}
                      </button>
                    </div>
                  </div>
                )}

                {interestSent && (
                  <div className="mb-4 space-y-3">
                    <p className="text-story-yellow-light text-sm font-medium">
                      {preorderUrl && checkoutReady !== true
                        ? "You're on the list — or preorder the hardcover now if you don't want to wait."
                        : "You're on the list — we'll email you when printed checkout is live."}
                    </p>
                    {preorderUrl && checkoutReady !== true ? (
                      <button
                        type="button"
                        onClick={() => openPreorder("post_waitlist")}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-story-purple font-bold text-sm shadow-lg hover:bg-story-yellow-light transition-colors"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Preorder now — ${bookPriceUsd}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleCopyShareLink()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/30 text-white/90 text-sm font-medium hover:border-white/60 hover:bg-white/10 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      {shareCopied ? "Link copied — paste for a friend" : "Copy link to share StoryMagic"}
                    </button>
                    <p className="text-white/45 text-xs">
                      Shared links include a referral tag so we can see word-of-mouth signups in admin Leads.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {checkoutReady === true && (
                    <button
                      onClick={handleOrder}
                      disabled={isOrdering}
                      className="flex items-center gap-3 px-8 py-4 bg-white text-story-purple rounded-2xl font-bold text-lg
                        hover:bg-story-yellow-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isOrdering ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Going to checkout…
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          Order for ${bookPriceUsd}
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleReset}
                    className="px-6 py-4 border-2 border-white/30 text-white/80 rounded-2xl font-semibold hover:border-white/60 hover:text-white transition-colors"
                  >
                    Create another story
                  </button>
                </div>

                <p className="text-white/50 text-xs mt-4">
                  Secure checkout via Stripe · Your story is saved
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400 text-sm border-t border-gray-100">
        <p>StoryMagic by 216labs · AI-powered children&apos;s storybooks</p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <a
            href="https://kidgift.6cubed.app?utm_source=storybook&utm_medium=footer&utm_campaign=storymagic"
            className="underline hover:text-story-purple transition-colors"
          >
            Need gift ideas first? → KidGift
          </a>
          <a
            href="https://6cubed.app/#storymagic-partners"
            className="underline hover:text-story-purple transition-colors"
          >
            Schools, daycare &amp; bulk orders →
          </a>
        </p>
      </footer>
    </main>
  );
}
