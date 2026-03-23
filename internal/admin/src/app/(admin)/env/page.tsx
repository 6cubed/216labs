import { getAllEnvVars } from "@/lib/db";
import { EnvVarEditor } from "@/components/EnvVarEditor";

export const dynamic = "force-dynamic";

export default async function EnvPage() {
  const envVars = getAllEnvVars();

  return (
    <section className="animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Environment variables
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Secrets and config used by apps at deploy time
        </p>
      </div>
      <EnvVarEditor vars={envVars} />
    </section>
  );
}
