import type { AppInfo } from "@/data/apps";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";
import { DeployToggle } from "./DeployToggle";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "";

function appUrl(appId: string): string | null {
  if (!APP_HOST || APP_HOST === "localhost") return null;
  return `https://${appId}.${APP_HOST}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSize(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

function StackTag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-white/5 text-muted rounded-md border border-white/5">
      {label}
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs text-foreground font-medium">{children}</span>
    </div>
  );
}

export function AppCard({
  app,
  isRunning,
}: {
  app: AppInfo;
  isRunning: boolean;
}) {
  const stackItems = [
    app.stack.frontend,
    app.stack.backend,
    app.stack.database,
    ...(app.stack.other ?? []),
  ].filter(Boolean);

  const url = appUrl(app.id);

  return (
    <div
      className={`group bg-surface border border-border rounded-2xl overflow-hidden transition-all duration-300 ${
        isRunning
          ? "hover:border-accent/30"
          : "opacity-50 hover:opacity-70"
      }`}
    >
      <div className="p-6">
        {/* Header with deploy toggle */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {url && isRunning ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link flex items-center gap-1.5 hover:text-accent transition-colors"
                >
                  <h3 className="text-lg font-semibold text-foreground truncate group-hover/link:text-accent transition-colors">
                    {app.name}
                  </h3>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted/50 group-hover/link:text-accent shrink-0 transition-colors mt-0.5"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : (
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {app.name}
                </h3>
              )}
              {url ? (
                isRunning ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-accent/70 bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded hover:bg-accent/20 hover:text-accent transition-colors"
                  >
                    {app.id}
                  </a>
                ) : (
                  <span className="text-xs font-mono text-muted bg-white/5 px-1.5 py-0.5 rounded">
                    {app.id}
                  </span>
                )
              ) : app.port > 0 ? (
                <span className="text-xs font-mono text-muted bg-white/5 px-1.5 py-0.5 rounded">
                  :{app.port}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted">{app.tagline}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeployToggle appId={app.id} isRunning={isRunning} />
            <StatusBadge status={isRunning ? "running" : "stopped"} />
          </div>
        </div>

        {/* Category + Image Size + Startup Time */}
        <div className="flex items-center gap-2 mb-4">
          <CategoryBadge category={app.category} />
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              app.imageSizeMB >= 800
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : app.imageSizeMB >= 500
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-white/5 text-muted border-white/5"
            }`}
          >
            {formatSize(app.imageSizeMB)}
          </span>
          {app.startupTimeMs != null && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              {app.startupTimeMs}ms
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-muted/80 leading-relaxed mb-4">
          {app.description}
        </p>

        {/* Stack */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {stackItems.map((item) => (
            <StackTag key={item} label={item!} />
          ))}
        </div>

        {/* Details */}
        <div className="bg-white/[0.02] rounded-xl px-4 py-1">
          <DetailRow label="Created">{formatDate(app.createdAt)}</DetailRow>
          <DetailRow label="Last Updated">
            {formatDate(app.lastUpdated)}
          </DetailRow>
          {app.lastDeployedAt && (
            <DetailRow label="Last Deployed">
              {formatDate(app.lastDeployedAt)}
            </DetailRow>
          )}
          <DetailRow label="Commits">{app.totalCommits}</DetailRow>
          <DetailRow label="Memory Limit">{app.memoryLimit}</DetailRow>
          {app.startupTimeMs != null && (
            <DetailRow label="Startup Time">
              <span className="font-mono text-[11px] text-cyan-400">
                {app.startupTimeMs}ms
              </span>
            </DetailRow>
          )}
          <DetailRow label="Image Size">
            <span className="font-mono text-[11px]">
              {formatSize(app.imageSizeMB)}
            </span>
          </DetailRow>
          <DetailRow label="Docker Image">
            <span className="font-mono text-[11px]">{app.dockerImage}</span>
          </DetailRow>
          <DetailRow label="Directory">
            <span className="font-mono text-[11px]">{app.directory}/</span>
          </DetailRow>
          {app.marketingSpend && (
            <>
              <DetailRow label="Marketing">
                {app.marketingSpend.monthly === 0
                  ? "No spend"
                  : `$${app.marketingSpend.monthly}/mo`}
              </DetailRow>
              <DetailRow label="Channel">
                {app.marketingSpend.channel}
              </DetailRow>
              {app.marketingSpend.notes && (
                <DetailRow label="Notes">
                  <span className="text-muted italic">
                    {app.marketingSpend.notes}
                  </span>
                </DetailRow>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
