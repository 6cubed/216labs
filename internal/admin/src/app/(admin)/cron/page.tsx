import { getCronJobs } from "@/lib/db";
import { CronJobsSection } from "@/components/CronJobsSection";

export const dynamic = "force-dynamic";

export default async function CronPage() {
  const cronJobs = getCronJobs();

  return (
    <section className="animate-fade-in">
      <CronJobsSection jobs={cronJobs} />
    </section>
  );
}
