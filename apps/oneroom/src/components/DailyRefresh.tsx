"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  RefreshCw,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Shuffle,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface OutfitScheme {
  title: string;
  description: string;
  styleNotes: string;
  items: {
    name: string;
    category: string;
    color: string;
    material: string;
    links: { store: string; url: string }[];
  }[];
}

interface DailyRefreshProps {
  apiKey: string;
  country: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  top: "👕",
  bottom: "👖",
  dress: "👗",
  outerwear: "🧥",
  shoes: "👟",
  bag: "👜",
  accessory: "🧣",
  jewelry: "💍",
  activewear: "🏃",
  underwear: "🩲",
};

export default function DailyRefresh({ apiKey, country }: DailyRefreshProps) {
  const { user } = useAuth();
  const [scheme, setScheme] = useState<OutfitScheme | null>(null);
  const [styleProfile, setStyleProfile] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchRefresh(regenerate = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/daily-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerate,
          apiKey: apiKey.trim() || undefined,
          country,
          userName: user?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScheme(data.scheme);
      setStyleProfile(data.styleProfile ?? "");
      setDate(data.date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prettyDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="glass-card rounded-3xl p-10 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-brand-100 border-t-brand-500"
          />
          <p className="text-sm text-surface-800/50">Styling your look for today…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchRefresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-5 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!scheme) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <h2 className="font-display text-3xl font-semibold text-surface-900 sm:text-4xl">
          Today&apos;s <span className="gradient-text">look</span>
        </h2>
        <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-surface-800/50">
          <Calendar className="h-3.5 w-3.5" />
          {prettyDate}
        </div>
      </motion.div>

      {styleProfile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 rounded-2xl bg-gradient-to-r from-brand-50 to-brand-100/30 p-5"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
            <div>
              <p className="text-xs font-semibold text-brand-700 mb-1">Your Style Profile</p>
              <p className="text-sm leading-relaxed text-surface-800/70">{styleProfile}</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card overflow-hidden rounded-3xl"
      >
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-white/70 text-xs font-medium mb-1">
            <Shuffle className="h-3.5 w-3.5" />
            Today&apos;s Random Look
          </div>
          <h3 className="font-display text-2xl font-semibold">{scheme.title}</h3>
          <p className="mt-1 text-sm text-white/80">{scheme.description}</p>
        </div>

        <div className="p-6 space-y-4">
          <ul className="space-y-3">
            {scheme.items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="rounded-xl border border-surface-200/60 bg-white/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none">
                      {CATEGORY_ICONS[item.category] ?? "✨"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-surface-900">{item.name}</p>
                      <p className="mt-0.5 text-xs text-surface-800/50">
                        {item.color} · {item.material} · {item.category}
                      </p>
                    </div>
                  </div>
                  <ShoppingBag className="h-4 w-4 flex-shrink-0 text-brand-300" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.links.map((link) => (
                    <a
                      key={link.store}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-800/70 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    >
                      {link.store}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>

          <div className="rounded-xl bg-brand-50/40 p-3">
            <p className="text-xs font-medium text-brand-700/80 leading-relaxed">
              <span className="font-semibold">Stylist note:</span> {scheme.styleNotes}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center"
      >
        <button
          onClick={() => fetchRefresh(true)}
          className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white/60 px-6 py-3 text-sm font-medium text-surface-800/70 backdrop-blur-sm transition-all hover:bg-white hover:text-surface-900 hover:shadow-md"
        >
          <Shuffle className="h-4 w-4" />
          Generate another look
        </button>
      </motion.div>
    </div>
  );
}
