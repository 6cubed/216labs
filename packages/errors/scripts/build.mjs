import * as esbuild from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

/** Node/CJS builds for Express and Next server paths (runtime-safe when not bundled). */
await esbuild.build({
  entryPoints: ["src/index.ts", "src/express.ts", "src/next.ts"],
  outdir: "dist",
  outbase: "src",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  format: "cjs",
  bundle: true,
  packages: "external",
  external: ["express", "next", "next/server", "react", "react/jsx-runtime"],
  target: "node20",
  logLevel: "info",
});
