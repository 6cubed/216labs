"use client";

import { useEffect, useState } from "react";

type Run = { id: string; name: string; status: string; createdAt: number };

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [runName, setRunName] = useState("demo-run");
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [enqueueN, setEnqueueN] = useState(5);
  const [log, setLog] = useState<string[]>([]);

  function push(msg: string) {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 200));
  }

  async function refreshRuns() {
    const res = await fetch("/api/admin/runs", { cache: "no-store" });
    const j = (await res.json()) as { ok: boolean; runs?: Run[] };
    if (j.ok && j.runs) {
      setRuns(j.runs);
      if (!selectedRunId && j.runs[0]) setSelectedRunId(j.runs[0].id);
    }
  }

  async function createRun() {
    const res = await fetch("/api/admin/runs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(adminKey ? { authorization: `Bearer ${adminKey}` } : {}),
      },
      body: JSON.stringify({ name: runName, config: { kind: "demo" } }),
    });
    const j = (await res.json()) as any;
    if (!res.ok || !j.ok) {
      push(`create run failed: ${j.error || res.status}`);
      return;
    }
    push(`created run ${j.run.id}`);
    await refreshRuns();
    setSelectedRunId(j.run.id);
  }

  async function enqueueTasks() {
    if (!selectedRunId) return;
    const tasks = Array.from({ length: enqueueN }).map((_, i) => ({
      payload: { n: 200_000 + i * 10_000 },
    }));
    const res = await fetch("/api/admin/tasks/enqueue", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(adminKey ? { authorization: `Bearer ${adminKey}` } : {}),
      },
      body: JSON.stringify({ runId: selectedRunId, kind: "demo_step", tasks }),
    });
    const j = (await res.json()) as any;
    if (!res.ok || !j.ok) {
      push(`enqueue failed: ${j.error || res.status}`);
      return;
    }
    push(`enqueued ${j.enqueued} tasks to ${selectedRunId}`);
  }

  useEffect(() => {
    void refreshRuns();
    const t = setInterval(() => void refreshRuns(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Admin</h1>
      <p style={{ color: "#555" }}>
        Create runs and enqueue work. Set <code>WEBGPUTRAINER_ADMIN_KEY</code> to require auth.
      </p>

      <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Admin key (optional)</label>
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Bearer token"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Run name</label>
            <input value={runName} onChange={(e) => setRunName(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => void createRun()} style={btnStyle}>
            Create run
          </button>
          <button onClick={() => void refreshRuns()} style={btnStyleAlt}>
            Refresh
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Enqueue tasks</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            style={{ ...inputStyle, minWidth: 280 }}
          >
            <option value="" disabled>
              Select a run…
            </option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.status})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={enqueueN}
            min={1}
            max={200}
            onChange={(e) => setEnqueueN(Number(e.target.value))}
            style={{ ...inputStyle, width: 120 }}
          />
          <button onClick={() => void enqueueTasks()} style={btnStyle} disabled={!selectedRunId}>
            Enqueue
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Runs</h2>
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          {runs.length ? (
            runs.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 220px",
                  gap: 12,
                  padding: "10px 12px",
                  borderTop: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ color: "#666" }}>{r.status}</div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 12, color: "#666" }}>(none yet)</div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Log</h2>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fafafa",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div>(no activity yet)</div>}
        </div>
      </section>
    </main>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#555", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  width: "100%",
};
const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
const btnStyleAlt: React.CSSProperties = {
  ...btnStyle,
  background: "#fff",
  color: "#111",
};

