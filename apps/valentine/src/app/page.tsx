"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Heart,
  Sparkles,
  Loader2,
  ShoppingCart,
  Star,
  Wand2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Step = "form" | "generating" | "preview";

const TONES = [
  { id: "romantic", label: "Romantic" },
  { id: "playful", label: "Playful" },
  { id: "poetic", label: "Poetic" },
  { id: "funny", label: "Funny" },
] as const;

interface GenerateResponse {
  cardId: string;
  title: string;
  insideMessage: string;
  imagePrompt: string;
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("form");
  const [idea, setIdea] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("romantic");
  const [error, setError] = useState<string | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [insideMessage, setInsideMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState("");

  const priceLabel = useMemo(() => {
    const cents = parseInt(
      process.env.NEXT_PUBLIC_VALENTINE_CARD_PRICE_CENTS ?? "1999",
      10
    );
    return `$${(cents / 100).toFixed(2)}`;
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim()) return;

    setError(null);
    setStep("generating");
    setImageUrl(null);
    setProgressLabel("Writing your card…");

    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          recipientName: recipientName.trim(),
          tone,
        }),
      });

      if (!genRes.ok) {
        const err = (await genRes.json()) as { error: string };
        throw new Error(err.error ?? "Failed to generate");
      }

      const genData = (await genRes.json()) as GenerateResponse;
      setCardId(genData.cardId);
      setTitle(genData.title);
      setInsideMessage(genData.insideMessage);

      setProgressLabel("Painting your cover art…");

      const illRes = await fetch("/api/illustrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: genData.cardId,
          imagePrompt: genData.imagePrompt,
        }),
      });

      if (illRes.ok) {
        const illData = (await illRes.json()) as { imageUrl: string };
        setImageUrl(illData.imageUrl);
      }

      setStep("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStep("form");
    }
  }

  async function handleOrder() {
    if (!cardId) return;
    setIsOrdering(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      setError(msg);
      setIsOrdering(false);
    }
  }

  function handleReset() {
    setStep("form");
    setCardId(null);
    setTitle("");
    setInsideMessage("");
    setImageUrl(null);
    setError(null);
    setProgressLabel("");
  }

  return (
    <main className="min-h-screen">
      <header className="relative overflow-hidden bg-gradient-to-br from-heart-rose via-heart-wine to-heart-rose py-16 px-6 text-center text-white">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-heart-gold/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-8 h-8 text-heart-blush fill-heart-blush/30" />
            <h1 className="text-5xl font-display font-bold tracking-tight">HeartInk</h1>
            <Heart className="w-8 h-8 text-heart-blush fill-heart-blush/30" />
          </div>
          <p className="text-xl text-white/85 mb-2">From a spark of an idea to a printed Valentine</p>
          <p className="text-white/60 text-sm">AI copy & cover art · Premium print · Shipped to you</p>
        </motion.div>

        <div className="relative z-10 flex items-center justify-center gap-1 mt-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-heart-gold text-heart-gold" />
          ))}
          <span className="text-white/60 text-sm ml-2">Made for real mailboxes</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-heart-rose-light">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-heart-rose-light rounded-xl flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-heart-rose" />
                  </div>
                  <h2 className="text-2xl font-bold text-heart-ink">Your idea</h2>
                </div>

                <form onSubmit={handleGenerate} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      What should this card be about? <span className="text-heart-rose">*</span>
                    </label>
                    <textarea
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="e.g. Our first winter together in Berlin, inside jokes about the cat, gratitude for long-distance finally ending…"
                      rows={4}
                      required
                      className="w-full px-4 py-3 rounded-2xl border-2 border-heart-rose-light focus:border-heart-rose focus:outline-none resize-none text-gray-700 placeholder-gray-300 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Recipient name <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Alex"
                      maxLength={40}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-heart-rose-light focus:border-heart-rose focus:outline-none text-gray-700 placeholder-gray-300 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTone(t.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            tone === t.id
                              ? "bg-heart-rose text-white shadow-md"
                              : "bg-heart-rose-light/80 text-heart-wine hover:bg-heart-rose-light"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!idea.trim()}
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-heart-rose to-heart-wine text-white
                      hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      flex items-center justify-center gap-3 shadow-lg shadow-heart-rose/25"
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate my card
                  </button>
                </form>
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { emoji: "💡", title: "You share", desc: "An idea, a name, a tone" },
                  { emoji: "✨", title: "AI designs", desc: "Cover art + inside message" },
                  { emoji: "📬", title: "We print", desc: "Shipped to you or them" },
                ].map(({ emoji, title: t, desc }) => (
                  <div
                    key={t}
                    className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100"
                  >
                    <div className="text-3xl mb-2">{emoji}</div>
                    <p className="font-semibold text-heart-ink text-sm">{t}</p>
                    <p className="text-xs text-gray-400 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="bg-white rounded-3xl shadow-xl p-10 border border-heart-rose-light">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-heart-rose to-heart-wine rounded-full flex items-center justify-center"
                >
                  <Heart className="w-10 h-10 text-white fill-white/20" />
                </motion.div>

                <h2 className="text-2xl font-bold text-heart-ink mb-2">Crafting something special…</h2>
                <p className="text-gray-500 mb-6">{progressLabel}</p>
                <Loader2 className="w-8 h-8 text-heart-rose animate-spin mx-auto" />
              </div>
            </motion.div>
          )}

          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  Your card is ready
                </div>
                <h2 className="text-3xl font-display font-bold text-heart-ink">{title}</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="rounded-3xl overflow-hidden border-4 border-white shadow-2xl bg-white aspect-[3/4] relative max-w-md mx-auto">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Card cover"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 400px"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 shimmer flex items-center justify-center text-gray-400 text-sm">
                      No image
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-heart-rose-light p-8 shadow-lg">
                  <p className="text-xs font-semibold text-heart-rose uppercase tracking-wide mb-2">
                    Inside message
                  </p>
                  <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {insideMessage}
                  </p>
                </div>
              </div>

              <div className="mt-10 bg-gradient-to-br from-heart-rose to-heart-wine rounded-3xl p-8 text-white text-center">
                <h3 className="text-2xl font-bold mb-2">Love it? Print it.</h3>
                <p className="text-white/85 mb-6">
                  Order a professionally printed card on premium stock, delivered to your door.
                </p>

                {error && (
                  <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl p-3 mb-4 text-white/90 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={handleOrder}
                    disabled={isOrdering}
                    className="flex items-center gap-3 px-8 py-4 bg-white text-heart-rose rounded-2xl font-bold text-lg
                      hover:bg-heart-rose-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isOrdering ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Going to checkout…
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Order for {priceLabel}
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleReset}
                    className="px-6 py-4 border-2 border-white/30 text-white/80 rounded-2xl font-semibold hover:border-white/60 hover:text-white transition-colors"
                  >
                    Start over
                  </button>
                </div>

                <p className="text-white/50 text-xs mt-4">
                  Secure checkout via Stripe · Your design is saved
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center py-8 text-gray-400 text-sm border-t border-heart-rose-light/50">
        <p>HeartInk by 216labs · AI Valentine&apos;s cards</p>
      </footer>
    </main>
  );
}
