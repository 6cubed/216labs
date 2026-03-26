"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/activity", label: "Activity" },
  { href: "/applications", label: "Applications" },
  { href: "/analytics", label: "Analytics" },
  { href: "/env", label: "Env" },
  { href: "/cron", label: "Cron" },
  { href: "/bridge-logs", label: "Bridge logs" },
  { href: "/todos", label: "Todos" },
  { href: "/orders", label: "Orders" },
  { href: "/architecture", label: "Architecture" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 w-full flex gap-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
