import { getAllApps } from "@/lib/db";
import { dbRowToAppInfo } from "@/data/apps";
import { AppCard } from "@/components/AppCard";
import { getRunningServices } from "@/lib/docker";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const rows = getAllApps();
  const apps = rows.map(dbRowToAppInfo);
  const runningServices = await getRunningServices();

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Applications</h2>
        <p className="text-xs text-muted">
          Toggle deploy to control what ships (admin always on)
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            isRunning={runningServices.has(app.dockerService)}
          />
        ))}
      </div>
    </section>
  );
}
