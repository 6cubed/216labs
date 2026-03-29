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
        <p className="text-xs text-muted mt-0.5 max-w-3xl">
          Secrets and config merged into <code className="text-[11px]">.env.admin</code> on deploy.
          Set <strong className="font-medium text-foreground/90">OPENAI_API_KEY</strong> once for the
          whole fleet; optional per-app <code className="text-[11px]">*_OPENAI_API_KEY</code> rows
          override when needed. GHCR and activator keys live under Deploy.
        </p>
      </div>
      <EnvVarEditor vars={envVars} />
    </section>
  );
}
