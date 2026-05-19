"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/activity", label: "Activity" },
  { href: "/errors", label: "Errors" },
  { href: "/applications", label: "Applications" },
  { href: "/analytics", label: "Analytics" },
  { href: "/data-lab", label: "Data Lab" },
  { href: "/tv-studio", label: "TV Studio" },
  { href: "/env", label: "Env" },
  { href: "/cron", label: "Cron" },
  { href: "/bridge-logs", label: "Bridge logs" },
  { href: "/todos", label: "Todos" },
  { href: "/orders", label: "Orders" },
  { href: "/architecture", label: "Architecture" },
] as const;

type AdminNavProps = {
  /** Reported + runtime error signals in the last 24h (badge on Errors tab). */
  errorSignalCount?: number;
  /** When set, the Errors tab links here (e.g. /errors?app=blog). */
  errorsHref?: string;
};

export function AdminNav({
  errorSignalCount = 0,
  errorsHref = "/errors",
}: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 w-full flex gap-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname?.startsWith(href + "/");
          const showBadge = href === "/errors" && errorSignalCount > 0;
          const linkHref = href === "/errors" ? errorsHref : href;
          return (
            <Link
              key={href}
              href={linkHref}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${
                isActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
              {showBadge ? (
                <span className="min-w-[1.25rem] rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {errorSignalCount > 99 ? "99+" : errorSignalCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
