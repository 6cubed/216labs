export function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {sublabel && (
        <p className="text-xs text-muted mt-1">{sublabel}</p>
      )}
    </div>
  );
}
