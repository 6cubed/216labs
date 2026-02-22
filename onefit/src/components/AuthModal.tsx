"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-surface-800/40 hover:bg-surface-100 hover:text-surface-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-8 pt-8 pb-2 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-surface-900">
                {mode === "signup" ? "Unlock your style profile" : "Welcome back"}
              </h2>
              <p className="mt-1.5 text-sm text-surface-800/50">
                {mode === "signup"
                  ? "Sign up to save preferences and get a daily personalized look"
                  : "Sign in to continue your style journey"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 px-8 pt-4 pb-8">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-800/30" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-surface-200 bg-surface-50/50 py-3 pl-10 pr-4 text-sm text-surface-900 placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-800/30" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-200 bg-surface-50/50 py-3 pl-10 pr-4 text-sm text-surface-900 placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-800/30" />
                <input
                  type="password"
                  placeholder={mode === "signup" ? "Create a password (6+ chars)" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50/50 py-3 pl-10 pr-4 text-sm text-surface-900 placeholder:text-surface-800/30 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200/50"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
              >
                {submitting
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>

              <p className="text-center text-xs text-surface-800/40 pt-1">
                {mode === "signup" ? "Already have an account?" : "Don\u2019t have an account?"}{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-medium text-brand-500 hover:text-brand-600 transition-colors"
                >
                  {mode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
