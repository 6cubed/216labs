"use client";

import { useState } from "react";
import { saveAppAnalytics } from "@/app/actions";
import type { AppInfo } from "@/data/apps";

type Row = {
  app: AppInfo;
  visits_30d: number;
  conversions_30d: number;
  revenue_proxy_30d: number;
  notes: string | null;
  updated_at: string | null;
  promiseScore: number;
};

export function AnalyticsTable({ rows }: { rows: Row[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    visits_30d: 0,
    conversions_30d: 0,
    revenue_proxy_30d: 0,
    notes: "",
  });

  function startEdit(row: Row) {
    setEditingId(row.app.id);
    setForm({
      visits_30d: row.visits_30d,
      conversions_30d: row.conversions_30d,
      revenue_proxy_30d: row.revenue_proxy_30d,
      notes: row.notes ?? "",
    });
    setError(null);
  }

  async function handleSave(appId: string) {
    setSaving(true);
    setError(null);
    const result = await saveAppAnalytics(appId, {
      visits_30d: form.visits_30d,
      conversions_30d: form.conversions_30d,
      revenue_proxy_30d: form.revenue_proxy_30d,
      notes: form.notes || null,
    });
    setSaving(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setEditingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted uppercase tracking-wider">
            <th className="px-4 py-3">App</th>
            <th className="px-4 py-3 text-right">Visits (30d)</th>
            <th className="px-4 py-3 text-right">Conversions (30d)</th>
            <th className="px-4 py-3 text-right">Revenue proxy (30d)</th>
            <th className="px-4 py-3 text-right">Promise score</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isEditing = editingId === row.app.id;
            return (
              <tr
                key={row.app.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {row.app.name}
                  <span className="ml-1.5 text-muted font-normal">
                    ({row.app.id})
                  </span>
                </td>
                {isEditing ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        value={form.visits_30d}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            visits_30d: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-foreground"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        value={form.conversions_30d}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            conversions_30d:
                              parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-foreground"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.revenue_proxy_30d}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            revenue_proxy_30d:
                              parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-foreground"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-muted">—</td>
                    <td className="px-4 py-2" colSpan={2}>
                      <input
                        type="text"
                        placeholder="Notes"
                        value={form.notes}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, notes: e.target.value }))
                        }
                        className="mr-2 w-48 rounded border border-border bg-background px-2 py-1 text-foreground"
                      />
                      {error && (
                        <span className="mr-2 text-xs text-red-500">{error}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSave(row.app.id)}
                        disabled={saving}
                        className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="ml-2 rounded border border-border px-3 py-1 text-xs font-medium text-muted hover:bg-muted/50"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {row.visits_30d.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {row.conversions_30d.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {row.revenue_proxy_30d > 0
                        ? row.revenue_proxy_30d.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.promiseScore >= 0.5
                            ? "bg-emerald-500/15 text-emerald-400"
                            : row.promiseScore >= 0.2
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-muted/50 text-muted"
                        }`}
                      >
                        {(row.promiseScore * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-muted">
                      {row.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
