import { dbRowToAppInfo } from "@/data/apps";
import { getAllApps } from "@/lib/db";

export function ArchitectureDiagram() {
  const apps = getAllApps().map(dbRowToAppInfo);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Architecture
      </h2>
      <p className="text-sm text-muted mb-5">
        Request flow from DNS through Caddy to each service
      </p>

      <div className="flex flex-col items-center gap-3 font-mono text-xs">
        {/* DNS */}
        <div className="bg-accent/10 border border-accent/25 text-accent rounded-lg px-6 py-2.5 font-medium">
          DNS: *.agimemes.com
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Caddy */}
        <div className="bg-purple-500/10 border border-purple-500/25 text-purple-400 rounded-lg px-6 py-2.5 font-medium">
          Caddy :80 / :443 (auto HTTPS)
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Services grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
          {apps.map((app) => (
            <div
              key={app.id}
              className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-center"
            >
              <p className="text-foreground font-medium text-[11px]">
                {app.name}
              </p>
              <p className="text-muted text-[10px]">{app.id}.agimemes.com</p>
            </div>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Data stores */}
        <div className="flex flex-wrap gap-2 justify-center">
          <div className="bg-blue-500/10 border border-blue-500/25 text-blue-400 rounded-lg px-4 py-2">
            PostgreSQL :5432
          </div>
          <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg px-4 py-2">
            Redis :6379
          </div>
          <div className="bg-slate-500/10 border border-slate-500/25 text-slate-400 rounded-lg px-4 py-2">
            SQLite (embedded)
          </div>
        </div>
      </div>
    </div>
  );
}
