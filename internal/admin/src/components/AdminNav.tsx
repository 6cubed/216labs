"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/activity", label: "Activity" },
  { href: "/errors", label: "Errors" },
  { href: "/applications", label: "Applications" },
  { href: "/org-metrics", label: "Org metrics" },
  { href: "/analytics", label: "Analytics" },
  { href: "/data-lab", label: "Data Lab" },
  { href: "/tv-studio", label: "TV Studio" },
  { href: "/env", label: "Env" },
  { href: "/cron", label: "Cron" },
  { href: "/bridge-logs", label: "Bridge logs" },
  { href: "/todos", label: "Todos" },
  { href: "/orders", label: "Orders" },
  { href: "/leads", label: "Leads" },
  { href: "/checkout-setup", label: "Checkout setup" },
  { href: "/architecture", label: "Architecture" },
  { href: "https://difftinder.6cubed.app", label: "DiffTinder", external: true },
  { href: "https://agitweet.6cubed.app", label: "Agitweet", external: true },
] as const;

type AdminNavProps = {
  /** Reported + runtime error signals in the last 24h (badge on Errors tab). */
  errorSignalCount?: number;
  /** When set, the Errors tab links here (e.g. /errors?app=blog). */
  errorsHref?: string;
  /** Highlight Checkout setup only when there is waitlist demand and no paid path. */
  revenueAttention?: boolean;
};

export function AdminNav({
  errorSignalCount = 0,
  errorsHref = "/errors",
  revenueAttention = false,
}: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 w-full flex gap-1">
        {NAV_ITEMS.map((item) => {
          const { href, label } = item;
          const external = "external" in item && item.external;
          const isActive =
            !external &&
            (href === "/"
              ? pathname === "/"
              : pathname === href || pathname?.startsWith(href + "/"));
          const showBadge = href === "/errors" && errorSignalCount > 0;
          const showRevenueDot =
            href === "/checkout-setup" && revenueAttention;
          const linkHref = href === "/errors" ? errorsHref : href;
          const className = `px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${
            isActive
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`;
          if (external) {
            return (
              <a
                key={href}
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {label}
                <span className="text-[10px] opacity-60" aria-hidden>
                  ↗
                </span>
              </a>
            );
          }
          return (
            <Link
              key={href}
              href={linkHref}
              className={className}
            >
              {label}
              {showBadge ? (
                <span className="min-w-[1.25rem] rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {errorSignalCount > 99 ? "99+" : errorSignalCount}
                </span>
              ) : null}
              {showRevenueDot ? (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                  title="Waitlist has demand and StoryMagic still has no paid path"
                  aria-label="Revenue setup needed"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
