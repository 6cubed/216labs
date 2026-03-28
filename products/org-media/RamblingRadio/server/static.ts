import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const GA4_RE = /^G-[A-Z0-9]+$/;

function injectGa4IntoHtml(html: string): string {
  const id = process.env.GA_MEASUREMENT_ID?.trim();
  if (!id || !GA4_RE.test(id)) return html;
  const snippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
  return html.replace("</head>", `${snippet}</head>`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = injectGa4IntoHtml(html);
    res.type("html").send(html);
  });
}
