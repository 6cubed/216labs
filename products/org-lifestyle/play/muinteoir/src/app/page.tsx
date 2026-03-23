import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">☘️</span>
          <span className="font-display font-bold text-xl text-brand-800">Múinteoir</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-surface-500">
          <span className="text-brand-600 font-medium">Gaeilge</span>
          <span>·</span>
          <span>Irish</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
            <span>🤖</span>
            <span>GPT-4o or fully local via WebGPU</span>
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-surface-900 mb-4 leading-tight">
            Learn Irish with{" "}
            <span className="gradient-text">AI-powered</span>{" "}
            conversation
          </h1>

          <p className="text-lg text-surface-500 mb-10 max-w-xl mx-auto">
            Practice real Gaeilge dialogue with instant corrections, or follow structured lessons
            from greetings to advanced grammar — all in your browser.
          </p>

          {/* Mode cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <Link
              href="/chat"
              className="glass-card rounded-2xl p-6 text-left hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="text-3xl mb-3">💬</div>
              <h2 className="font-display font-bold text-lg text-surface-900 mb-1 group-hover:text-brand-700 transition-colors">
                Comhrá
              </h2>
              <p className="text-sm text-surface-500 mb-1">Free Conversation</p>
              <p className="text-xs text-surface-400">
                Chat naturally in Irish. Get real-time translations and corrections after each message.
              </p>
            </Link>

            <Link
              href="/lessons"
              className="glass-card rounded-2xl p-6 text-left hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="text-3xl mb-3">📚</div>
              <h2 className="font-display font-bold text-lg text-surface-900 mb-1 group-hover:text-brand-700 transition-colors">
                Ceachtanna
              </h2>
              <p className="text-sm text-surface-500 mb-1">Structured Lessons</p>
              <p className="text-xs text-surface-400">
                Guided lessons on vocab, grammar, and culture — from beginner to advanced.
              </p>
            </Link>

            <Link
              href="/privatechat"
              className="glass-card rounded-2xl p-6 text-left hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="text-3xl mb-3">🔒</div>
              <h2 className="font-display font-bold text-lg text-surface-900 mb-1 group-hover:text-surface-700 transition-colors">
                Príobháideach
              </h2>
              <p className="text-sm text-surface-500 mb-1">Private Chat</p>
              <p className="text-xs text-surface-400">
                Runs a local AI model in your browser via WebGPU. No API key, no server, fully offline.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-surface-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                No data leaves your device
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-surface-400">
        <p>
          <span className="text-brand-600">Is féidir leat Gaeilge a fhoghlaim!</span>
          {" "}— You can learn Irish!
        </p>
      </footer>
    </main>
  );
}
