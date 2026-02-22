import { notFound } from "next/navigation";
import Link from "next/link";
import { mysteries, getMysteryBySlug } from "@/data/mysteries";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Timeline } from "@/components/Timeline";

export function generateStaticParams() {
  return mysteries.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mystery = getMysteryBySlug(slug);
  if (!mystery) return { title: "Not Found — HiveFind" };
  return {
    title: `${mystery.title} — HiveFind`,
    description: mystery.summary,
  };
}

export default async function MysteryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mystery = getMysteryBySlug(slug);
  if (!mystery) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to all mysteries
      </Link>

      <header className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={mystery.status} />
          <CategoryBadge category={mystery.category} />
          <span className="rounded bg-surface-light px-2 py-0.5 text-xs font-medium text-muted">
            {mystery.region}
          </span>
        </div>

        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {mystery.title}
        </h1>
        <p className="mb-4 text-lg text-muted">{mystery.subtitle}</p>

        <div className="flex items-center gap-4 text-sm text-muted/70">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {mystery.date}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {mystery.region}, {mystery.country}
          </span>
        </div>
      </header>

      <section className="mb-10 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Summary
        </h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          {mystery.summary}
        </p>
      </section>

      {mystery.keyFacts.length > 0 && (
        <section className="mb-10 rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Key Facts
          </h2>
          <ul className="space-y-2.5">
            {mystery.keyFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {fact}
              </li>
            ))}
          </ul>
        </section>
      )}

      {mystery.persons.length > 0 && (
        <section className="mb-10 rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Key Persons
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {mystery.persons.map((person, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-surface-light p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-bold">
                  {person.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {person.name}
                  </p>
                  <p className="text-xs text-muted">{person.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Timeline
            <span className="ml-2 text-sm font-normal text-muted">
              ({mystery.timeline.length} events)
            </span>
          </h2>
        </div>
        <Timeline events={mystery.timeline} />
      </section>

      {mystery.tags.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {mystery.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
        <h2 className="mb-2 text-base font-semibold text-accent">
          Have information about this case?
        </h2>
        <p className="mb-4 text-sm text-muted">
          If you have a credible tip or information related to this mystery,
          please contact the relevant authorities directly. You can also share
          your information through our platform.
        </p>
        <div className="flex gap-3">
          <Link
            href="/#submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-amber-400"
          >
            Submit a Tip
          </Link>
          <a
            href="https://www.garda.ie/en/contact-us/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-light"
          >
            Contact Gardaí
          </a>
        </div>
      </section>
    </div>
  );
}
