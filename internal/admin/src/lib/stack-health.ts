import { getCronRunnerState } from "@/lib/db";

export const STACK_HEALTH_STATE_KEY = "stack_health_last";

export type StackProbeRow = {
  id: string;
  ok: boolean;
  status: number;
  error: string | null;
};

export type StackHealthSnapshot = {
  at: string;
  issues: number;
  diagnosis: "ok" | "edge_proxy" | "spine_down" | "degraded";
  external: StackProbeRow[];
  internal: StackProbeRow[];
};

export function parseStackHealthSnapshot(
  raw: string | null
): StackHealthSnapshot | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as StackHealthSnapshot;
    if (!d?.at || !d.diagnosis) return null;
    return d;
  } catch {
    return null;
  }
}

export function stackHealthMetric(snapshot: StackHealthSnapshot | null): {
  value: string;
  sublabel: string;
  tone: "ok" | "warn" | "bad";
} {
  if (!snapshot) {
    return { value: "—", sublabel: "cron stack-health-check", tone: "ok" };
  }
  const at = snapshot.at.replace("T", " ").slice(0, 16);
  if (snapshot.diagnosis === "ok" && snapshot.issues === 0) {
    return { value: "Edge OK", sublabel: `cron ${at} UTC`, tone: "ok" };
  }
  if (snapshot.diagnosis === "edge_proxy") {
    return {
      value: "Caddy / edge",
      sublabel: `internal OK · ${at} UTC`,
      tone: "warn",
    };
  }
  if (snapshot.diagnosis === "spine_down") {
    return { value: "Spine down", sublabel: `cron ${at} UTC`, tone: "bad" };
  }
  return {
    value: `${snapshot.issues} edge issue(s)`,
    sublabel: `${snapshot.diagnosis} · ${at} UTC`,
    tone: "warn",
  };
}

export function getStackHealthSnapshot(): StackHealthSnapshot | null {
  return parseStackHealthSnapshot(getCronRunnerState(STACK_HEALTH_STATE_KEY));
}
