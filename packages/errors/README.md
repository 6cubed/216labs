# @216labs/errors

Shared error types and **centralized client/server reporting** to admin (`client_error_event` in `216labs.db`).

## Next.js (browser)

1. Add dependency: `"@216labs/errors": "file:../../../packages/errors"` (adjust path).
2. `transpilePackages: ["@216labs/errors"]` in `next.config`.
3. Root layout (once):

```tsx
import { ClientErrorReporter } from "@216labs/errors/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClientErrorReporter appId="your-manifest-id" />
        {children}
      </body>
    </html>
  );
}
```

Docker: use **repo-root** `build.context` and copy `packages/errors` (see `products/org-shopping/onefit/Dockerfile` or `internal/admin/Dockerfile`).

## Python (Flask / FastAPI / static HTML)

COPY `internal/python/client_error_report.py` into the image (repo-root Docker `build.context`).

**Browser (preferred — one source of truth):**

```python
from client_error_report import client_error_script, report_server_error

# Flask context processor → templates
@app.context_processor
def _inject_client_error_script():
    return {"client_error_script_html": client_error_script("your-manifest-id")}
```

Template: `{{ client_error_script_html | safe }}` before `</body>`.

FastAPI static HTML: replace `<!-- CLIENT_ERRORS -->` in `index.html` with `client_error_script("app-id")` in the index route.

**Server 500s:**

```python
report_server_error("your-manifest-id", str(exc), stack=traceback.format_exc(), url=request.url)
```

Node-only UIs (e.g. PipeSecure): copy the same ingest URL into `src/error-report.ts` (see `internal/security/pipesecure/src/error-report.ts`).

## Query (heartbeats)

```bash
./scripts/query_client_errors.sh onefit 24
```

Ingest: `POST https://admin.6cubed.app/api/public/report-error` (see `docs/REPOSITORY.md`).

**Vite / Express apps** (RamblingRadio, Stroll): call `installBrowserErrorReporting({ appId })` in `client/src/main.tsx`; Docker needs repo-root context (see `products/org-social/Stroll.live/Dockerfile`). **Docker:** In Dockerfiles with repo-root `build.context`, run `scripts/docker-build-errors-package.sh` after `COPY packages/errors` (before the app `npm install`). That emits `dist/*.cjs` for Node `require()` and copies cleanly into `node_modules/@216labs/errors`. Vite/Express apps also run `scripts/verify-errors-node-runtime.sh` at build time. Next.js apps keep `transpilePackages: ["@216labs/errors"]` for `src/` at bundle time. The activator and GHCR CI read `config/errors-runtime-services.txt` (override on the droplet with `ACTIVATOR_ERRORS_RUNTIME_SERVICES`). CI runs `scripts/verify-image-errors-runtime.sh` before push; the activator refuses to retag broken GHCR `:latest` over a working local image.

Vite+Express apps with esbuild server bundles: add `@216labs/errors` to the allowlist and `packages: "bundle"` in `script/build.ts` (see RamblingRadio).

**Heartbeat / monitoring:** `./scripts/heartbeat-stack-check.sh` — audit, DB summary, public admin APIs, then live probes from `config/errors-html-probe-*.txt` (see **`config/README-errors-reporting.md`**). Droplet in-container checks: `./scripts/probe-droplet-reporters.sh root@46.101.88.197`. Rollup only: `./scripts/heartbeat-error-summary.sh 6`.

**Flutter (anchor):** `ErrorReporter.install()` in `lib/main.dart`; server uses `app/client_error_report.py` (not `@216labs/errors` npm).
