import { getAllEnvVars } from "@/lib/db";
import { getRevenueReadiness } from "@/lib/revenue-readiness";
import { EnvVarEditor } from "@/components/EnvVarEditor";
import { RevenueReadinessPanel } from "@/components/RevenueReadinessPanel";

export const dynamic = "force-dynamic";

export default async function EnvPage() {
  const vars = getAllEnvVars();
  const revenue = await getRevenueReadiness(vars);

  return (
    <section className="animate-fade-in space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Environment</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Secrets and config sync to the droplet on deploy. Set Stripe keys here,
          then redeploy paid apps — see{" "}
          <code className="text-[11px]">docs/FIRST-SALE.md</code> in the repo.
        </p>
      </div>
      <RevenueReadinessPanel data={revenue} />
      <EnvVarEditor vars={vars} />
    </section>
  );
}
