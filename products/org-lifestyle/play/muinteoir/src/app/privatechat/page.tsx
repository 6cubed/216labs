import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

const PrivateChatInterface = dynamic(
  () => import("@/components/PrivateChatInterface"),
  { ssr: false }
);

export default function PrivateChatPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={15} />
            Back
          </Link>
          <span className="text-surface-300">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xl">☘️</span>
            <span className="font-display font-bold text-surface-800">Múinteoir</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 text-surface-600 text-xs font-medium">
          <Lock size={11} />
          <span>Runs locally · no API key</span>
        </div>
      </nav>

      {/* Chat area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pb-4 flex flex-col min-h-0">
        <div className="glass-card rounded-2xl flex-1 overflow-hidden flex flex-col min-h-0">
          <PrivateChatInterface />
        </div>
      </div>
    </main>
  );
}
