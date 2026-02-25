import Link from "next/link";
import Countdown from "@/components/Countdown";
import { getParticipantCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  let count = 0;
  try {
    count = getParticipantCount();
  } catch {
    count = 0;
  }

  return (
    <main className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SwissCross />
            <span className="font-bold text-lg tracking-tight text-[#1a1a1a]">
              The Zurich Dating Game
            </span>
          </div>
          <Link
            href="/signup"
            className="bg-[#d52b1e] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#b02318] transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 text-[#d52b1e] text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 bg-[#d52b1e] rounded-full animate-pulse" />
          {count > 0 ? `${count} people already joined` : "Now accepting sign-ups"}
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#1a1a1a] leading-tight mb-6">
          Find your match
          <br />
          <span className="text-[#d52b1e]">in Zurich</span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Zurich&apos;s first AI-powered dating event. Sign up, answer a few
          questions about yourself, and on{" "}
          <strong className="text-[#1a1a1a]">April 1st</strong> our AI
          matchmaker will pair you with your ideal first date.
        </p>

        {/* Countdown */}
        <div className="mb-12">
          <p className="text-sm text-gray-400 uppercase tracking-widest mb-6 font-medium">
            Matches revealed in
          </p>
          <Countdown />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-[#d52b1e] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#b02318] transition-colors shadow-lg shadow-red-200"
          >
            Join the game →
          </Link>
          <a
            href="#how-it-works"
            className="text-[#1a1a1a] px-8 py-4 rounded-full text-lg font-semibold border border-gray-200 hover:border-gray-300 hover:bg-white transition-colors"
          >
            How it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="bg-white border-t border-gray-100 py-20"
      >
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-[#1a1a1a] mb-4">
            How it works
          </h2>
          <p className="text-center text-gray-500 mb-14 text-lg">
            Three simple steps to your perfect Zurich date.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              number="01"
              title="Create your profile"
              description="Tell us about yourself — who you are, what you love about Zurich, and what you're looking for in a partner."
            />
            <Step
              number="02"
              title="Wait for April 1st"
              description="Our AI matchmaker analyzes every profile to find your most compatible match across the city."
            />
            <Step
              number="03"
              title="Go on your date"
              description="You'll receive your match by email on April 1st. From there, it's up to you — no apps, no swiping."
            />
          </div>
        </div>
      </section>

      {/* Why section */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#1a1a1a] mb-6">
              Dating in Zurich,{" "}
              <span className="text-[#d52b1e]">done differently</span>
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Zurich is one of the world&apos;s greatest cities — but its
                dating scene can feel like a closed door. We&apos;re changing
                that with a single, city-wide matching event.
              </p>
              <p>
                No endless swiping. No algorithmic feed. Just one thoughtful AI
                match, delivered once, on April 1st. The rest is up to you.
              </p>
              <p className="font-medium text-[#1a1a1a]">
                This is The Zurich Dating Game — and everyone wins a first date.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat value="April 1st" label="Match day" />
            <Stat value="1 match" label="Per person" />
            <Stat value="AI-powered" label="Matchmaking" />
            <Stat value="Free" label="To join" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#d52b1e] py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to play?
          </h2>
          <p className="text-red-100 text-lg mb-10 leading-relaxed">
            Sign up takes less than 5 minutes. Your match could be in Zurich
            right now, waiting for the same thing.
          </p>
          <Link
            href="/signup"
            className="bg-white text-[#d52b1e] px-8 py-4 rounded-full text-lg font-bold hover:bg-red-50 transition-colors shadow-xl"
          >
            Sign me up
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <SwissCross size={16} />
            <span>The Zurich Dating Game · 2026</span>
          </div>
          <span>A 216 Labs experiment</span>
        </div>
      </footer>
    </main>
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

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-4xl font-bold text-[#d52b1e] opacity-30 font-mono">
        {number}
      </span>
      <h3 className="text-xl font-bold text-[#1a1a1a]">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#faf8f5] rounded-2xl p-6 border border-gray-100">
      <div className="text-2xl font-bold text-[#1a1a1a] mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
