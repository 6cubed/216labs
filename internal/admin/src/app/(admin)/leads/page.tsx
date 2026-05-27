import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  created_at: string;
  kind: string;
  email: string;
  message: string;
  source_app_id: string;
  referrer: string | null;
};

function safeTrim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

export default async function LeadsPage() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, created_at, kind, email, message, source_app_id, referrer
       FROM lead_event
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all() as LeadRow[];

  return (
    <section className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted">
            Captured from public funnels (e.g. <span className="font-mono">6cubed.app</span>).
          </p>
        </div>
        <div className="text-xs text-muted">
          Showing <span className="font-semibold text-foreground">{rows.length}</span> most recent
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No leads yet. Send one from <a className="underline" href="https://6cubed.app/">6cubed.app</a>.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const email = safeTrim(r.email);
                  const message = safeTrim(r.message);
                  const when = safeTrim(r.created_at);
                  const kind = safeTrim(r.kind) || "lead";
                  const source = safeTrim(r.source_app_id);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{when}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                          {kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {email ? (
                          <a className="underline" href={`mailto:${encodeURIComponent(email)}`}>
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {message ? (
                          <span className="text-foreground">{message}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {r.referrer ? (
                          <div className="mt-1 text-xs text-muted">
                            <span className="font-mono">ref:</span> {r.referrer}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{source || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

