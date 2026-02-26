import { infrastructure } from "@/data/apps";

function InfraRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

export function InfraOverview() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Infrastructure
      </h2>
      <p className="text-sm text-muted mb-4">
        Single VPS deployment via Docker Compose + Caddy
      </p>

      <div className="px-1">
        <InfraRow label="Provider" value={infrastructure.provider} />
        <InfraRow label="Droplet IP" value={infrastructure.dropletIp} />
        <InfraRow label="Monthly Cost" value={infrastructure.monthlyCost} />
        <InfraRow label="Reverse Proxy" value={infrastructure.reverseProxy} />
        <InfraRow
          label="Databases"
          value={infrastructure.databases.join(", ")}
        />
        <InfraRow label="Total Apps" value={infrastructure.totalApps} />
        <InfraRow
          label="Memory Allocated"
          value={infrastructure.totalMemoryAllocated}
        />
        <InfraRow label="Domain" value={infrastructure.domain} />
        <InfraRow label="Deploy Method" value={infrastructure.deployMethod} />
      </div>
    </div>
  );
}
