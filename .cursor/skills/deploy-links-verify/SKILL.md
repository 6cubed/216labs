---
name: deploy-links-verify
description: >-
  Always return deploy links for apps being touched (and verify they are up before returning them). Use when modifying any app under products/ (or other deployable services) and when closing out a task that changes user-facing behavior.
---

# Deploy links + verification (216labs)

## When to apply

- At the end of any task that edits an app under `products/**` (or otherwise deployable services in this repo).
- When the user asks “is X up”, “what’s the link”, “did it deploy”, or similar.

## Goal

- Return **deploy links** for the app(s) you touched.
- **Verify each link is up** (HTTP response is expected) before returning it.

## Workflow

1. Identify touched apps.
   - Use `git diff --name-only` (and include staged + unstaged if relevant).
   - Map paths to app ids:
     - `products/**/<app>/manifest.json` contains `"id": "<app_id>"`.
     - If you touched `products/**/<app>/src/**`, use the nearest `products/**/<app>/manifest.json` to resolve the id.

2. Determine deploy URLs.
   - Default rule: `https://<app_id>.6cubed.app`
   - Known exceptions:
     - `landing` → `https://6cubed.app` and `https://www.6cubed.app`

3. Verify each URL is up.
   - Probe the URL with a short timeout.
   - Accept:
     - `200` (OK)
     - `301/302/307/308` (expected redirects)
     - `401/403` (expected if the app is gated, but it’s still “up”)
   - Reject / treat as “not up”:
     - `000` / timeout / DNS errors
     - `5xx`

4. Return links.
   - Provide a short list:
     - app id → deploy URL → verified status (include HTTP code)
   - If a link is not up:
     - Say so explicitly
     - Provide the next concrete action (wait for CI/GHCR, run `./deploy.sh root@46.101.88.197`, or fix env keys).

## Notes

- “Up” means **the edge is responding**; it does not necessarily mean the newest commit is live.
- If the user explicitly asks for a droplet rollout, follow the repo’s deploy rules and run `./deploy.sh root@46.101.88.197`.

