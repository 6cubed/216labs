"use client";

import { motion } from "framer-motion";
import { Sparkles, Scissors, Palette, Shirt } from "lucide-react";

const steps = [
  { icon: Sparkles, label: "Analyzing your style…" },
  { icon: Palette, label: "Matching colors & tones…" },
  { icon: Scissors, label: "Tailoring recommendations…" },
  { icon: Shirt, label: "Generating outfit visuals…" },
];

export default function ProcessingAnimation({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center py-16">
      <motion.div
        className="relative mb-10"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <div className="h-28 w-28 rounded-full border-4 border-brand-100" />
        <div className="absolute inset-0 h-28 w-28 rounded-full border-4 border-transparent border-t-brand-500" />
      </motion.div>

      <div className="space-y-4 w-full max-w-sm">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: isDone || isActive ? 1 : 0.35,
                x: 0,
              }}
              transition={{ delay: i * 0.15 }}
              className={`flex items-center gap-3 rounded-xl px-5 py-3 transition-colors ${
                isActive
                  ? "glass-card animate-pulse-glow"
                  : isDone
                    ? "bg-brand-50/50"
                    : ""
              }`}
            >
              <Icon
                className={`h-5 w-5 flex-shrink-0 ${
                  isActive
                    ? "text-brand-500"
                    : isDone
                      ? "text-brand-400"
                      : "text-surface-300"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? "text-surface-900"
                    : isDone
                      ? "text-surface-800/70"
                      : "text-surface-800/30"
                }`}
              >
                {s.label}
              </span>
              {isDone && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto text-xs text-brand-500"
                >
                  ✓
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.p
        className="mt-8 text-sm text-surface-800/40"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Your personal stylist is at work…
      </motion.p>
    </div>
  );
}
