import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="h-screen flex flex-col max-w-3xl mx-auto px-4">
      {/* Back link */}
      <div className="py-3 flex-shrink-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-700 transition-colors"
        >
          <ArrowLeft size={14} />
          Baile
        </Link>
      </div>

      {/* Chat fills remaining height */}
      <div className="flex-1 min-h-0 glass-card rounded-2xl overflow-hidden mb-4">
        <ChatInterface mode="conversation" />
      </div>
    </div>
  );
}
