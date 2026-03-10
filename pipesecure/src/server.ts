import express from "express";
import crypto from "crypto";
import { config } from "./config";
import { runScan } from "./scan";

const app = express();

// Parse raw body so we can verify the HMAC signature before touching the payload
app.use(express.raw({ type: "*/*", limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "pipesecure" });
});

app.post("/webhook", (req, res) => {
  const sig = req.headers["x-hub-signature-256"] as string | undefined;
  const event = req.headers["x-github-event"] as string | undefined;

  if (config.github.webhookSecret && sig) {
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", config.github.webhookSecret)
        .update(req.body as Buffer)
        .digest("hex");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  res.status(200).json({ received: true });

  if (event === "push") {
    try {
      const payload = JSON.parse((req.body as Buffer).toString());
      const branch = payload.ref?.replace("refs/heads/", "");
      if (branch === config.github.branch) {
        const sha: string | undefined = payload.after;
        console.log(
          `[webhook] Push to ${branch}${sha ? ` (${sha.slice(0, 7)})` : ""} — starting scan`
        );
        runScan(sha).catch((err) => console.error("[webhook] Scan error:", err));
      }
    } catch (err) {
      console.error("[webhook] Failed to parse payload:", err);
    }
  }
});

app.post("/scan", (_req, res) => {
  res.status(202).json({ message: "Scan started" });
  runScan().catch((err) => console.error("[manual scan] Error:", err));
});

app.listen(config.port, () => {
  console.log(`[pipesecure] Listening on port ${config.port}`);
  if (config.scanOnStartup) {
    console.log("[pipesecure] Running startup scan...");
    runScan().catch((err) => console.error("[startup scan] Error:", err));
  }
});
