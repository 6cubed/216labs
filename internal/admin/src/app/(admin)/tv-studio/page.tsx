import { TvStudioClient } from "@/components/TvStudioClient";

export const dynamic = "force-dynamic";

export default function TvStudioPage() {
  return (
    <>
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">YouTube TV Studio</h2>
        <p className="text-sm text-muted mt-1 max-w-3xl">
          Grounded LLM drafting for scripted series: predefined character bibles and series rules are
          injected into every request so the model cannot invent new series-regulars. Defaults are a
          cheap-to-shoot mockumentary tone; swap the roster via JSON to match your production.
        </p>
        <p className="text-xs text-muted mt-2 border border-border/60 rounded-md px-3 py-2 bg-muted/20 max-w-3xl">
          This is an admin-only tool. Configure{" "}
          <code className="text-foreground/90">OPENROUTER_API_KEY</code> (recommended for cost) or{" "}
          <code className="text-foreground/90">OPENAI_API_KEY</code> in admin env vars. Optional{" "}
          <code className="text-foreground/90">ADMIN_TV_STUDIO_MODEL</code> overrides the default
          (OpenRouter: <code className="text-foreground/90">google/gemini-2.0-flash-001</code>, OpenAI:{" "}
          <code className="text-foreground/90">gpt-4o-mini</code>). Output is a writers&apos; room
          draft — you remain responsible for rights, talent, and platform policies.
        </p>
      </section>
      <TvStudioClient />
    </>
  );
}
