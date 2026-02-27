"use client";

import { useState } from "react";
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
} from "lucide-react";
import BookViewer, { BookPage } from "@/components/BookViewer";

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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setError(null);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStep("form");
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

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      setError(msg);
      setIsOrdering(false);
    }
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
            Powered by AI · Professionally printed · Delivered to your door
          </p>
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
                <p className="text-white/80 mb-6">
                  Order a professionally printed, full-colour hardback book delivered to your door.
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

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
                        Order for $24.99
                      </>
                    )}
                  </button>

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
      </footer>
    </main>
  );
}
