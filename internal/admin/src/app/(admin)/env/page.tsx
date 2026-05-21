import { EnvVarEditor } from "@/components/EnvVarEditor";
import { RevenueReadinessPanel } from "@/components/RevenueReadinessPanel";
import { getAllEnvVars } from "@/lib/db";
import { getRevenueReadiness } from "@/lib/revenue-readiness";

export const dynamic = "force-dynamic";

export default async function EnvPage() {
  const vars = getAllEnvVars();
  const revenue = await getRevenueReadiness(vars);

  return (
    <div className="space-y-10">
      <RevenueReadinessPanel data={revenue} />
      <EnvVarEditor vars={vars} />
    </div>
  );
}
