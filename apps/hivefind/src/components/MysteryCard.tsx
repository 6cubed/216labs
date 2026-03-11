import Link from "next/link";
import { Mystery } from "@/data/types";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";

export function MysteryCard({ mystery }: { mystery: Mystery }) {
  return (
    <Link
      href={`/mysteries/${mystery.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-all hover:border-accent/30 hover:bg-surface-light hover:shadow-lg hover:shadow-accent/5"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <StatusBadge status={mystery.status} />
        <CategoryBadge category={mystery.category} />
      </div>

      <h3 className="mb-1.5 text-base font-semibold leading-snug text-foreground group-hover:text-accent transition-colors">
        {mystery.title}
      </h3>
      <p className="mb-3 text-sm leading-relaxed text-muted line-clamp-2">
        {mystery.subtitle}
      </p>

      <div className="mt-auto flex items-center gap-3 text-xs text-muted/70">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {mystery.date}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {mystery.region}
        </span>
        <span className="ml-auto flex items-center gap-1 text-accent/60">
          {mystery.timeline.length} events
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
