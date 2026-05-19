import Link from "next/link";

export function MetricCard({
  label,
  value,
  sublabel,
  href,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {sublabel ? <p className="text-xs text-muted mt-1">{sublabel}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-surface border border-border rounded-xl p-5 transition-colors hover:border-accent/40"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      {inner}
    </div>
  );
}
