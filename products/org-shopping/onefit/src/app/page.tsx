"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  Shirt,
  Calendar,
  LogOut,
  User,
} from "lucide-react";
import UploadZone from "@/components/UploadZone";
import ProcessingAnimation from "@/components/ProcessingAnimation";
import ResultsGrid from "@/components/ResultsGrid";
import DailyLook from "@/components/DailyLook";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/AuthContext";
import type { OutfitRecommendation } from "@/lib/openai";

type Step = "input" | "processing" | "results";
type Tab = "stylist" | "daily";

export default function Home() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("stylist");
  const [step, setStep] = useState<Step>("input");
  const [image, setImage] = useState<string | null>(null);
  const [occasion, setOccasion] = useState("");
  const [preferences, setPreferences] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const [outfits, setOutfits] = useState<OutfitRecommendation[]>([]);
  const [votes, setVotes] = useState<Record<number, "up" | "down">>({});
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingVoteRef = useRef<{
    outfit: OutfitRecommendation;
    vote: "up" | "down";
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("onefit-api-key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (value) localStorage.setItem("onefit-api-key", value);
    else localStorage.removeItem("onefit-api-key");
  }

  const canSubmit = image && occasion.trim().length > 0 && apiKey.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setStep("processing");
    setProcessingStep(0);
    setError(null);

    intervalRef.current = setInterval(() => {
      setProcessingStep((prev) => Math.min(prev + 1, 3));
    }, 3500);

    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          occasion,
          preferences,
          apiKey: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setOutfits(data.outfits);
      setVotes({});
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStep("results");
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("input");
    }
  }

  function handleStartOver() {
    setStep("input");
    setImage(null);
    setOccasion("");
    setPreferences("");
    setAnalysis("");
    setOutfits([]);
    setVotes({});
    setError(null);
    setProcessingStep(0);
  }

  async function submitVote(outfit: OutfitRecommendation, vote: "up" | "down") {
    setVotes((prev) => ({ ...prev, [outfit.id]: vote }));
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitTitle: outfit.title,
          outfitJson: outfit,
          vote,
          occasion,
        }),
      });
    } catch {
      // silently fail — vote is shown optimistically
    }
  }

  function handleVote(outfit: OutfitRecommendation, vote: "up" | "down") {
    if (!user) {
      pendingVoteRef.current = { outfit, vote };
      setAuthModalOpen(true);
      return;
    }
    submitVote(outfit, vote);
  }

  function handleAuthSuccess() {
    if (pendingVoteRef.current) {
      const { outfit, vote } = pendingVoteRef.current;
      pendingVoteRef.current = null;
      submitVote(outfit, vote);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center relative"
      >
        {/* User menu (top-right) */}
        {user && (
          <div className="absolute right-0 top-0 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-surface-800/60">
              <User className="h-3.5 w-3.5" />
              {user.name}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-surface-800/40 hover:bg-surface-100 hover:text-surface-800 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}

        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-600 mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Personal Styling
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-surface-900 sm:text-5xl lg:text-6xl">
          One<span className="gradient-text">Fit</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-surface-800/50 sm:text-lg">
          Upload your photo, describe the occasion, and your AI stylist will
          craft the perfect outfits — ready to shop.
        </p>
      </motion.header>

      {/* Tab navigation — only shown when logged in */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex rounded-xl bg-white/60 p-1 backdrop-blur-sm border border-surface-200/60">
            <button
              onClick={() => setActiveTab("stylist")}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
                activeTab === "stylist"
                  ? "bg-white text-surface-900 shadow-sm"
                  : "text-surface-800/50 hover:text-surface-800/70"
              }`}
            >
              <Shirt className="h-4 w-4" />
              Stylist
            </button>
            <button
              onClick={() => setActiveTab("daily")}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
                activeTab === "daily"
                  ? "bg-white text-surface-900 shadow-sm"
                  : "text-surface-800/50 hover:text-surface-800/70"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Daily Look
            </button>
          </div>
        </motion.div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* ---- STYLIST TAB ---- */}
        {activeTab === "stylist" && step === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-auto max-w-2xl"
          >
            <div className="glass-card rounded-3xl p-6 sm:p-8">
              {/* API Key */}
              <div className="mb-6">
                <label
                  htmlFor="apiKey"
                  className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-800"
                >
                  <Key className="h-3.5 w-3.5 text-brand-500" />
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-surface-200 bg-white/60 px-4 py-2.5 pr-10 text-sm text-surface-900 font-mono placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-800/30 hover:text-surface-800/60 transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-surface-800/40">
                  Stored locally in your browser. Never sent anywhere except
                  OpenAI.
                </p>
              </div>

              <UploadZone
                onImageSelected={setImage}
                currentImage={image}
                onClear={() => setImage(null)}
              />

              <div className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="occasion"
                    className="mb-1.5 block text-sm font-medium text-surface-800"
                  >
                    What&apos;s the occasion?
                  </label>
                  <textarea
                    id="occasion"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="e.g. Summer wedding in Tuscany, casual Friday at a creative agency, first date at a rooftop bar…"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-surface-200 bg-white/60 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="preferences"
                    className="mb-1.5 block text-sm font-medium text-surface-800"
                  >
                    Style preferences{" "}
                    <span className="text-surface-800/40">(optional)</span>
                  </label>
                  <textarea
                    id="preferences"
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    placeholder="e.g. I love earth tones, prefer minimal jewellery, want something that shows confidence…"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-surface-200 bg-white/60 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50 transition-all"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </motion.div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:shadow-brand-500/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                Style me
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "stylist" && step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-auto max-w-lg"
          >
            <div className="glass-card rounded-3xl p-8">
              <ProcessingAnimation step={processingStep} />
            </div>
          </motion.div>
        )}

        {activeTab === "stylist" && step === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ResultsGrid
              analysis={analysis}
              outfits={outfits}
              onStartOver={handleStartOver}
              votes={votes}
              onVote={handleVote}
            />
          </motion.div>
        )}

        {/* ---- DAILY LOOK TAB ---- */}
        {activeTab === "daily" && user && (
          <motion.div
            key="daily"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DailyLook apiKey={apiKey} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          pendingVoteRef.current = null;
        }}
        onSuccess={handleAuthSuccess}
      />
    </main>
  );
}
