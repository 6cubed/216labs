import { getAllApps, getAllEnvVars } from "@/lib/db";
import { dbRowToAppInfo, infrastructure } from "@/data/apps";
import { AppCard } from "@/components/AppCard";
import { MetricCard } from "@/components/MetricCard";
import { InfraOverview } from "@/components/InfraOverview";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { SizeOverview } from "@/components/SizeOverview";
import { EnvVarEditor } from "@/components/EnvVarEditor";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const rows = getAllApps();
  const apps = rows.map(dbRowToAppInfo);
  const envVars = getAllEnvVars();

  const enabledApps = new Set(apps.filter((a) => a.deployEnabled).map((a) => a.id));
  const enabledCount = enabledApps.size;
  const totalCommits = apps.reduce((sum, a) => sum + a.totalCommits, 0);
  const enabledImageSizeMB = apps
    .filter((a) => a.deployEnabled)
    .reduce((sum, a) => sum + a.imageSizeMB, 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                216labs
                <span className="text-accent ml-2 font-normal text-lg">
                  Pipeline Dashboard
                </span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Monorepo overview &mdash; {apps.length} applications,{" "}
                {enabledCount} deployed
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
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary metrics */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
          <MetricCard
            label="Applications"
            value={apps.length}
            sublabel={`${enabledCount} deployed`}
          />
          <MetricCard
            label="Deploy Size"
            value={
              enabledImageSizeMB >= 1000
                ? `${(enabledImageSizeMB / 1000).toFixed(1)} GB`
                : `${enabledImageSizeMB} MB`
            }
            sublabel="App images only"
          />
          <MetricCard
            label="Monthly Cost"
            value={infrastructure.monthlyCost}
            sublabel={infrastructure.provider}
          />
          <MetricCard
            label="Total Commits"
            value={totalCommits}
            sublabel="Across all apps"
          />
        </section>

        {/* Deploy Size Overview + Infrastructure */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          <SizeOverview apps={apps} enabledApps={enabledApps} />
          <InfraOverview />
        </section>

        {/* Application cards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Applications
            </h2>
            <p className="text-xs text-muted">
              Toggle deploy to control which apps are transferred to the server
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>

        <EnvVarEditor vars={envVars} />

        {/* Architecture */}
        <section className="animate-fade-in">
          <ArchitectureDiagram />
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-xs text-muted">
            216labs Pipeline Dashboard &mdash; Powered by SQLite &mdash;{" "}
            <span className="font-mono">
              {new Date().toISOString().split("T")[0]}
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}
