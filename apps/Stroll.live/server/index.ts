import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true }));
app.use(express.json());

registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(__dirname, "../dist/public");
  app.use(express.static(publicDir));
  app.use("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(publicDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[stroll] API on http://localhost:${PORT}`);
});
