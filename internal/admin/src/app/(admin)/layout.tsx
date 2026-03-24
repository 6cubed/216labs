import { AdminNav } from "@/components/AdminNav";
import { infrastructure } from "@/data/apps";
import { getAllApps } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rows = getAllApps();
  const enabledCount = rows.filter(
    (r) => r.deploy_enabled === 1 || r.id === "admin"
  ).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                216Labs
                <span className="text-accent ml-2 font-normal text-base">Admin</span>
              </h1>
              <p className="text-sm text-muted mt-1 max-w-2xl">
                Monorepo registry: every app with a manifest or Dockerfile, plus deploy
                and runtime status. Pages are rendered dynamically (no static cache).
              </p>
              <p className="text-xs text-muted mt-0.5">
                {rows.length} apps in DB · {enabledCount} deploy-enabled
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {infrastructure.dropletIp}
              </span>
            </div>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>

      <footer className="border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-muted text-center max-w-3xl mx-auto">
            At 216Labs we are building the toolkit for production grade vibes. · SQLite ·{" "}
            {new Date().toISOString().split("T")[0]}
          </p>
        </div>
      </footer>
    </div>
  );
}
