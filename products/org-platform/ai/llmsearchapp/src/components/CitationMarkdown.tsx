"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Source } from "@/lib/types";

const mdComponents = {
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: ReactNode;
  }) => (
    <a
      href={href}
      className="text-sky-400 underline-offset-2 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

/** Markdown answer; [n] markers become links to sources[n-1]. */
export function CitationMarkdown({
  content,
  sources,
}: {
  content: string;
  sources: Source[];
}) {
  if (!sources.length) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-[var(--text)] prose-strong:text-[var(--text)]"
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
    );
  }

  const segments = content.split(/(\[\d+\])/g);
  return (
    <div className="space-y-1">
      {segments.map((seg, i) => {
        const m = seg.match(/^\[(\d+)\]$/);
        if (m) {
          const n = parseInt(m[1]!, 10);
          const s = sources[n - 1];
          if (s) {
            return (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="citation"
                title={s.title}
              >
                {n}
              </a>
            );
          }
          return <span key={i}>{seg}</span>;
        }
        if (!seg) return null;
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-[var(--text)] prose-strong:text-[var(--text)] [&>p]:my-1"
            components={mdComponents}
          >
            {seg}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
