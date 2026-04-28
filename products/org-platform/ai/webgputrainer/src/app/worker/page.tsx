"use client";

import { useEffect, useMemo, useState } from "react";

type RegisterResp = { workerId: string; workerSecret: string };
type ClaimResp = { ok: true; task: null | { id: string; kind: string; payload: any } };

function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export default function WorkerPage() {
  const [name, setName] = useState("");
  const [registered, setRegistered] = useState<RegisterResp | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const webgpu = useMemo(() => hasWebGPU(), []);

  function push(msg: string) {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 200));
  }

  async function register() {
    const res = await fetch("/api/workers/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || undefined, webgpu }),
    });
    const j = (await res.json()) as RegisterResp;
    setRegistered(j);
    push(`registered worker ${j.workerId} (webgpu=${webgpu})`);
  }

  async function workerLoop() {
    if (!registered) return;
    setRunning(true);
    push("loop started");
    const headers = {
      "x-worker-id": registered.workerId,
      "x-worker-secret": registered.workerSecret,
    };

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const hb = await fetch("/api/workers/heartbeat", { method: "POST", headers }).catch(() => null);
      if (!hb || !hb.ok) push("heartbeat failed");

      // eslint-disable-next-line no-await-in-loop
      const claim = await fetch("/api/tasks/claim", { method: "POST", headers }).catch(() => null);
      if (!claim || !claim.ok) {
        push("claim failed");
        // eslint-disable-next-line no-await-in-loop
        await sleep(1500);
        continue;
      }
      const cj = (await claim.json()) as ClaimResp;
      if (!cj.task) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(1200);
        continue;
      }

      push(`claimed task ${cj.task.id} (${cj.task.kind})`);

      // Execute (MVP): a small CPU-side placeholder + optional WebGPU smoke test.
      const started = Date.now();
      let ok = true;
      let error: string | undefined;
      let result: any = { tookMs: 0 };
      try {
        if (webgpu) {
          await webgpuSmokeTest();
          result.webgpu = "ok";
        } else {
          result.webgpu = "unavailable";
        }
        // dummy “training step”
        const n = Number(cj.task.payload?.n ?? 200_000);
        let acc = 0;
        for (let i = 0; i < n; i++) acc = (acc + i) % 1_000_000_007;
        result.acc = acc;
      } catch (e) {
        ok = false;
        error = (e as Error).message || "task_failed";
      } finally {
        result.tookMs = Date.now() - started;
      }

      // eslint-disable-next-line no-await-in-loop
      const rep = await fetch("/api/tasks/report", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ taskId: cj.task.id, ok, result, error }),
      }).catch(() => null);
      if (!rep || !rep.ok) {
        push(`report failed for task ${cj.task.id}`);
      } else {
        push(`reported task ${cj.task.id}: ${ok ? "ok" : "failed"} (${result.tookMs}ms)`);
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(300);
    }
  }

  useEffect(() => {
    if (!running) return;
    // hard refresh to stop loop
  }, [running]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Worker</h1>
      <p style={{ color: "#555" }}>
        This page turns your browser into a volunteer worker. Keep it open. For MVP we poll tasks.
      </p>

      <section style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>WebGPU:</span>
          <span>{webgpu ? "available" : "not available"}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="optional worker name"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 240,
            }}
            disabled={!!registered}
          />
          {!registered ? (
            <button
              onClick={register}
              style={btnStyle}
            >
              Register
            </button>
          ) : (
            <button
              onClick={() => void workerLoop()}
              style={btnStyle}
              disabled={running}
            >
              {running ? "Running…" : "Start loop"}
            </button>
          )}
        </div>
        {registered && (
          <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
            Worker id: <code>{registered.workerId}</code>
          </div>
        )}
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
            maxHeight: 360,
            overflow: "auto",
          }}
        >
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div>(no activity yet)</div>}
        </div>
      </section>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function webgpuSmokeTest() {
  // Very small check: request adapter and device.
  // We keep it lightweight so workers can run on phones/laptops.
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) throw new Error("no_webgpu_adapter");
  const device = await adapter.requestDevice();
  if (!device) throw new Error("no_webgpu_device");
  device.destroy?.();
}

