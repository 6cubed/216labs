"use client";

import { motion } from "framer-motion";
import OutfitCard from "./OutfitCard";
import type { OutfitRecommendation } from "@/lib/openai";
import { RefreshCw } from "lucide-react";

interface ResultsGridProps {
  analysis: string;
  outfits: OutfitRecommendation[];
  onStartOver: () => void;
  votes: Record<number, "up" | "down">;
  onVote: (outfit: OutfitRecommendation, vote: "up" | "down") => void;
}

export default function ResultsGrid({
  analysis,
  outfits,
  onStartOver,
  votes,
  onVote,
}: ResultsGridProps) {
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h2 className="font-display text-3xl font-semibold text-surface-900 sm:text-4xl">
          Your <span className="gradient-text">curated looks</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-surface-800/60">
          {analysis}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {outfits.map((outfit, i) => (
          <OutfitCard
            key={outfit.id}
            outfit={outfit}
            index={i}
            vote={votes[outfit.id] ?? null}
            onVote={onVote}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 text-center"
      >
        <button
          onClick={onStartOver}
          className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white/60 px-6 py-3 text-sm font-medium text-surface-800/70 backdrop-blur-sm transition-all hover:bg-white hover:text-surface-900 hover:shadow-md"
        >
          <RefreshCw className="h-4 w-4" />
          Start over with a new look
        </button>
      </motion.div>
    </div>
  );
}
