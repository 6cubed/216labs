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

## Python (server)

```python
from client_error_report import report_server_error  # copy or import from internal/python/
report_server_error(app_id="anchor", message="...", kind="server")
```

## Query (heartbeats)

```bash
./scripts/query_client_errors.sh onefit 24
```

Ingest: `POST https://admin.6cubed.app/api/public/report-error` (see `docs/REPOSITORY.md`).

**Vite / Express apps** (RamblingRadio, Stroll): call `installBrowserErrorReporting({ appId })` in `client/src/main.tsx`; Docker needs repo-root context (see `products/org-social/Stroll.live/Dockerfile`). If the server is bundled with esbuild and most deps are externalized, add `@216labs/errors` to the **allowlist** (RamblingRadio `script/build.ts`) or bundle it in a dedicated server step—otherwise Node loads raw `.ts` from `node_modules` and crashes at startup.

**Heartbeat:** `./scripts/heartbeat-error-summary.sh 6` — per-app error counts.
