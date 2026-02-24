import { getStats } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let stats;
  try {
    stats = getStats();
  } catch {
    stats = {
      totalEvents: 0,
      resolvedEvents: 0,
      totalEstimates: 0,
      lastFetched: null,
    };
  }

  return <Dashboard initialStats={stats} />;
}
