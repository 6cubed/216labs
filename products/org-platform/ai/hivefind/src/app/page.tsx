import { MysteryGrid } from "@/components/MysteryGrid";
import { TipForm } from "@/components/TipForm";
import { mysteries } from "@/data/mysteries";

export default function Home() {
  const unsolvedCount = mysteries.filter((m) => m.status === "unsolved").length;
  const totalEvents = mysteries.reduce((sum, m) => sum + m.timeline.length, 0);

  return (
    <div>
      <section className="border-b border-border bg-gradient-to-b from-surface to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
              Crowd-sourced investigation platform
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Every clue counts.
              <br />
              <span className="text-accent">Join the hive.</span>
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-muted">
              HiveFind brings together timelines, evidence, and community tips
              for unsolved mysteries. Browse cases, study the timelines, and
              submit your own leads.
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-accent">{mysteries.length}</span>
                <span className="text-muted">Cases</span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-red-400">{unsolvedCount}</span>
                <span className="text-muted">Unsolved</span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{totalEvents}</span>
                <span className="text-muted">Timeline Events</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <MysteryGrid />
      </section>

      <section id="about" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold">About HiveFind</h2>
            <p className="text-muted leading-relaxed">
              HiveFind is a crowd-sourced platform dedicated to gathering and
              organising information about unsolved mysteries. We believe that
              collective knowledge can help bring resolution to cases that have
              gone cold. Our platform provides comprehensive timelines and
              encourages responsible information sharing. Always report
              actionable tips directly to the relevant law enforcement
              authorities.
            </p>
          </div>
        </div>
      </section>

      <section id="submit" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="mb-2 text-2xl font-bold">Submit a Tip</h2>
            <p className="mb-8 text-sm text-muted">
              Have information about a case? Share it securely. All tips are
              reviewed and passed to relevant authorities where appropriate.
            </p>
            <TipForm />
          </div>
        </div>
      </section>
    </div>
  );
}
