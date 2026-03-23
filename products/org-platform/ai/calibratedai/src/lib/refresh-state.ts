export interface RefreshStatus {
  isRunning: boolean;
  phase: "idle" | "fetching-events" | "running-models" | "done" | "error";
  total: number;
  completed: number;
  errors: number;
  startedAt: string | null;
  message: string;
}

export const refreshState: RefreshStatus = {
  isRunning: false,
  phase: "idle",
  total: 0,
  completed: 0,
  errors: 0,
  startedAt: null,
  message: "Ready",
};
