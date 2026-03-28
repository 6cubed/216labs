import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

const GA4_RE = /^G-[A-Z0-9]+$/;

function injectGa4IntoHtml(html: string): string {
  const id = process.env.GA_MEASUREMENT_ID?.trim();
  if (!id || !GA4_RE.test(id)) return html;
  const snippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
  return html.replace("</head>", `${snippet}</head>`);
}

app.use(cors({ origin: true }));
app.use(express.json());

registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(__dirname, "../dist/public");
  app.use(express.static(publicDir));
  app.use("/{*splat}", (_req, res) => {
    const indexPath = path.resolve(publicDir, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectGa4IntoHtml(html);
    res.type("html").send(html);
  });
}

app.listen(PORT, () => {
  console.log(`[stroll] API on http://localhost:${PORT}`);
});
