"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FormData = {
  name: string;
  age: string;
  gender: string;
  interested_in: string;
  occupation: string;
  neighborhood: string;
  bio: string;
  three_things: string;
  perfect_date: string;
  email: string;
};

const NEIGHBORHOODS = [
  "Altstadt",
  "City",
  "Wiedikon",
  "Aussersihl",
  "Langstrasse",
  "Wipkingen",
  "Höngg",
  "Albisrieden",
  "Altstetten",
  "Schwamendingen",
  "Oerlikon",
  "Seefeld",
  "Enge",
  "Wollishofen",
  "Leimbach",
  "Witikon",
  "Fluntern",
  "Hottingen",
  "Hirslanden",
  "Zürichberg",
  "Outside Zurich",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormData>({
    name: "",
    age: "",
    gender: "",
    interested_in: "",
    occupation: "",
    neighborhood: "",
    bio: "",
    three_things: "",
    perfect_date: "",
    email: "",
  });

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.name.trim()) return "Please enter your name.";
      if (!form.age || parseInt(form.age) < 18 || parseInt(form.age) > 99)
        return "Please enter a valid age (18+).";
      if (!form.gender) return "Please select your gender.";
      if (!form.interested_in) return "Please select who you're interested in.";
    }
    if (step === 2) {
      if (!form.bio.trim() || form.bio.trim().length < 30)
        return "Tell us a bit more about yourself (at least 30 characters).";
      if (!form.three_things.trim() || form.three_things.trim().length < 20)
        return "Please share three things you can't live without.";
      if (!form.perfect_date.trim() || form.perfect_date.trim().length < 20)
        return "Describe your perfect first date (at least 20 characters).";
    }
    if (step === 3) {
      if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email))
        return "Please enter a valid email address.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: parseInt(form.age),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.push("/thank-you");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <main className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <SwissCross />
            <span className="font-bold text-lg tracking-tight text-[#1a1a1a]">
              The Zurich Dating Game
            </span>
          </Link>
          <span className="text-sm text-gray-400">
            Step {step} of {totalSteps}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full bg-[#d52b1e] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center py-12 px-6">
        <div className="w-full max-w-lg">
          {/* Step 1: Basic info */}
          {step === 1 && (
            <FormStep
              title="Let's start with the basics"
              subtitle="Tell us who you are."
            >
              <Field label="First name">
                <input
                  type="text"
                  placeholder="Your first name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </Field>

              <Field label="Age">
                <input
                  type="number"
                  placeholder="Your age"
                  min={18}
                  max={99}
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="I am a...">
                <div className="grid grid-cols-3 gap-3">
                  {["Man", "Woman", "Non-binary"].map((g) => (
                    <ChoiceButton
                      key={g}
                      label={g}
                      selected={form.gender === g}
                      onClick={() => update("gender", g)}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Interested in">
                <div className="grid grid-cols-3 gap-3">
                  {["Men", "Women", "Everyone"].map((i) => (
                    <ChoiceButton
                      key={i}
                      label={i}
                      selected={form.interested_in === i}
                      onClick={() => update("interested_in", i)}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Occupation (optional)">
                <input
                  type="text"
                  placeholder="What do you do?"
                  value={form.occupation}
                  onChange={(e) => update("occupation", e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Neighborhood (optional)">
                <select
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select your neighborhood</option>
                  {NEIGHBORHOODS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </FormStep>
          )}

          {/* Step 2: Personality */}
          {step === 2 && (
            <FormStep
              title="Tell us about yourself"
              subtitle="This is what your match will see."
            >
              <Field
                label="About you"
                hint="What makes you, you? What do you love about Zurich?"
              >
                <textarea
                  placeholder="I'm a Swiss-German who grew up eating Zürcher Geschnetzeltes and now..."
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
                <CharCount value={form.bio} min={30} max={500} />
              </Field>

              <Field
                label="Three things you can't live without"
                hint="Could be anything — people, places, things, rituals."
              >
                <textarea
                  placeholder="Good coffee, Sunday walks along the Limmat, and my dog Bruno"
                  value={form.three_things}
                  onChange={(e) => update("three_things", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                <CharCount value={form.three_things} min={20} max={300} />
              </Field>

              <Field
                label="Your perfect first date in Zurich"
                hint="Describe the ideal scenario — be specific!"
              >
                <textarea
                  placeholder="A coffee at Café des Amis, then a walk up Lindenhügel to watch the sunset..."
                  value={form.perfect_date}
                  onChange={(e) => update("perfect_date", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                <CharCount value={form.perfect_date} min={20} max={300} />
              </Field>
            </FormStep>
          )}

          {/* Step 3: Email */}
          {step === 3 && (
            <FormStep
              title="Almost there"
              subtitle="We'll send your match here on April 1st."
            >
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>Privacy first.</strong> Your email is only used to
                  send you your match. It&apos;s never shared publicly or sold.
                </p>
              </div>

              <Field label="Email address">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </Field>

              {/* Summary */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                <h3 className="font-semibold text-[#1a1a1a] mb-4">
                  Your profile summary
                </h3>
                <SummaryRow label="Name" value={form.name} />
                <SummaryRow label="Age" value={`${form.age} years old`} />
                <SummaryRow
                  label="Gender"
                  value={`${form.gender}, interested in ${form.interested_in}`}
                />
                {form.neighborhood && (
                  <SummaryRow
                    label="Neighborhood"
                    value={form.neighborhood}
                  />
                )}
                {form.occupation && (
                  <SummaryRow label="Occupation" value={form.occupation} />
                )}
              </div>
            </FormStep>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 border border-gray-200 text-[#1a1a1a] py-3 rounded-full font-semibold hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
            {step < totalSteps ? (
              <button
                onClick={next}
                className="flex-1 bg-[#d52b1e] text-white py-3 rounded-full font-semibold hover:bg-[#b02318] transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-[#d52b1e] text-white py-3 rounded-full font-semibold hover:bg-[#b02318] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Joining..." : "Join the game 🎲"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[#1a1a1a] placeholder-gray-400 focus:outline-none focus:border-[#d52b1e] focus:ring-2 focus:ring-red-100 transition-colors";

function FormStep({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">{title}</h1>
      <p className="text-gray-400 mb-8">{subtitle}</p>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#1a1a1a]">
        {label}
      </label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function ChoiceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
        selected
          ? "bg-[#d52b1e] border-[#d52b1e] text-white shadow-sm"
          : "bg-white border-gray-200 text-[#1a1a1a] hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function CharCount({
  value,
  min,
  max,
}: {
  value: string;
  min: number;
  max: number;
}) {
  const len = value.trim().length;
  const ok = len >= min;
  return (
    <p
      className={`text-xs mt-1 ${
        len === 0
          ? "text-gray-300"
          : ok
          ? "text-green-500"
          : "text-amber-500"
      }`}
    >
      {len}/{max} chars{!ok && len > 0 ? ` (${min - len} more needed)` : ""}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-[#1a1a1a] text-right">{value}</span>
    </div>
  );
}

function SwissCross({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#d52b1e" />
      <rect x="10" y="4" width="4" height="16" fill="white" />
      <rect x="4" y="10" width="16" height="4" fill="white" />
    </svg>
  );
}
