export const dynamic = "force-dynamic";

const LOG_FILES = [
  {
    name: "pocket-bridge.log",
    desc: "Rotating capture of all bridge console lines (same timestamps as your terminal).",
  },
  {
    name: "pocket-bridge-events.jsonl",
    desc: "Structured JSON lines (startup and other instrumented events).",
  },
] as const;

export default function BridgeLogsPage() {
  const root =
    "internal/admin/pocket-cursor-bridge/logs/";
  return (
    <section className="animate-fade-in max-w-3xl">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        PocketCursor bridge — logging
      </h2>
      <p className="text-sm text-muted mb-6">
        The Telegram ↔ Cursor bridge runs on the machine where you start{" "}
        <code className="text-xs bg-muted/50 px-1 rounded">
          ./scripts/pocket-cursor-bridge.sh
        </code>
        . Logs are written next to the bridge code (not on the VPS admin host).
      </p>

      <div className="rounded-lg border border-border bg-card/30 p-4 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Log files</h3>
        <p className="text-xs text-muted mb-3 font-mono break-all">{root}</p>
        <ul className="space-y-3 text-sm text-foreground">
          {LOG_FILES.map(({ name, desc }) => (
            <li key={name}>
              <span className="font-mono text-xs text-accent">{name}</span>
              <span className="text-muted"> — {desc}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-2">Telegram</h3>
        <p className="text-sm text-muted mb-2">
          From your paired chat, use the bot menu or send:
        </p>
        <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
          <li>
            <code className="text-xs">/logs</code> — tail of the text log (recent lines)
          </li>
          <li>
            <code className="text-xs">/logevents</code> — tail of structured JSON events
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card/30 p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Terminal</h3>
        <pre className="text-xs bg-muted/40 border border-border rounded p-3 overflow-x-auto text-muted-foreground">
          {`cd internal/admin/pocket-cursor-bridge
tail -f logs/pocket-bridge.log`}
        </pre>
      </div>
    </section>
  );
}
