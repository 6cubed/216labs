"use client";

import { motion } from "framer-motion";
import {
  ExternalLink,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useState } from "react";
import type { OutfitRecommendation } from "@/lib/openai";

interface OutfitCardProps {
  outfit: OutfitRecommendation;
  index: number;
  vote?: "up" | "down" | null;
  onVote?: (outfit: OutfitRecommendation, vote: "up" | "down") => void;
}

export default function OutfitCard({
  outfit,
  index,
  vote,
  onVote,
}: OutfitCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12, duration: 0.5 }}
      className="glass-card group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-brand-200/20"
    >
      {outfit.imageUrl ? (
        <div className="relative aspect-[9/14] w-full overflow-hidden bg-surface-100">
          <img
            src={outfit.imageUrl}
            alt={outfit.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-5">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              Look {index + 1}
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">
              {outfit.title}
            </h3>
          </div>
        </div>
      ) : (
        <div className="flex aspect-[9/14] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100/50">
          <div className="text-center p-5">
            <ShoppingBag className="mx-auto h-10 w-10 text-brand-300 mb-3" />
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600">
              Look {index + 1}
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-surface-900">
              {outfit.title}
            </h3>
          </div>
        </div>
      )}

      <div className="p-5">
        <p className="text-sm leading-relaxed text-surface-800/70">
          {outfit.description}
        </p>

        {/* Thumbs up / down */}
        {onVote && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onVote(outfit, "up")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                vote === "up"
                  ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                  : "bg-surface-50 text-surface-800/50 hover:bg-green-50 hover:text-green-600"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {vote === "up" ? "Loved" : "Love it"}
            </button>
            <button
              onClick={() => onVote(outfit, "down")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                vote === "down"
                  ? "bg-red-100 text-red-600 ring-1 ring-red-200"
                  : "bg-surface-50 text-surface-800/50 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              {vote === "down" ? "Nope" : "Not for me"}
            </button>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex w-full items-center justify-between rounded-xl bg-surface-50 px-4 py-2.5 text-sm font-medium text-surface-800 transition-colors hover:bg-surface-100"
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-brand-500" />
            {outfit.items.length} items — Shop now
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <motion.div
          initial={false}
          animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <ul className="mt-3 space-y-3">
            {outfit.items.map((item, i) => (
              <li
                key={i}
                className="rounded-xl border border-surface-200/60 bg-white/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-surface-900">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-800/50">
                      {item.color} · {item.category}
                    </p>
                  </div>
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
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="mt-4 rounded-xl bg-brand-50/40 p-3">
          <p className="text-xs font-medium text-brand-700/80 leading-relaxed">
            <span className="font-semibold">Style note:</span> {outfit.styleNotes}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
