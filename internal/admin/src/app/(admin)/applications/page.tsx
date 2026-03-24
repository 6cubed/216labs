import { getAllApps } from "@/lib/db";
import { dbRowToAppInfo } from "@/data/apps";
import { AppsOverviewTable } from "@/components/AppsOverviewTable";
import { ProjectOverviewBanner } from "@/components/ProjectOverviewBanner";
import { getRunningServices } from "@/lib/docker";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const rows = getAllApps();
  const apps = rows.map(dbRowToAppInfo);
  const runningServices = await getRunningServices();
  const runningList = [...runningServices];
  const renderedAtIso = new Date().toISOString();

  return (
    <section className="animate-fade-in space-y-6">
      <ProjectOverviewBanner appCount={apps.length} renderedAtIso={renderedAtIso} />

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Application registry
        </h2>
        <p className="text-sm text-muted mb-4">
          Deploy toggle updates SQLite and starts or stops the container when possible.
          “Running” reflects Docker; “Deploy” is the intended shipped set.
        </p>
        <AppsOverviewTable apps={apps} runningServiceNames={runningList} />
      </div>
    </section>
  );
}
