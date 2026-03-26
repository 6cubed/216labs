<div align="center">
  <img src="docs/assets/readme-banner.jpg" alt="" width="100%" />
</div>

<br />

<h3 align="center">216labs</h3>

<p align="center">
  One tree. Many apps. One spine.<br />
  <em>SQLite · Caddy · Docker Compose · manifest-driven shipping</em>
</p>

<p align="center">
  <a href="https://6cubed.app">6cubed.app</a>
  &nbsp;·&nbsp;
  <a href="https://admin.6cubed.app">admin</a>
  &nbsp;·&nbsp;
  <a href="docs/REPOSITORY.md">handbook</a>
  &nbsp;·&nbsp;
  <a href="docs/TOOLKIT.md">toolkit</a>
</p>

---

This monorepo is a production host and a reusable pattern: one SQLite source of truth, one admin surface, one deploy path, HTTPS at the edge, optional cold-starts via the activator. `products/org-platform/toolkit-demos/` proves the pipeline; the rest of `products/` is the live fleet—fork it, delete what you don’t need, keep the spine.

| If you want… | Open |
|--------------|------|
| Greenfield / first deploy | [`docs/TOOLKIT.md`](docs/TOOLKIT.md), [`config/examples/toolkit-starter/`](config/examples/toolkit-starter/) |
| New app scaffold | `./scripts/new-app.sh` |
| Deploy, layout, architecture, cron, Pocket bridge | [`docs/REPOSITORY.md`](docs/REPOSITORY.md) |
| Showroom / caps / GHCR sync | [`docs/SCALING.md`](docs/SCALING.md), [`docs/DROPLET_SYNC.md`](docs/DROPLET_SYNC.md) |

---

<p align="center">
  <sub>Main tells the story. Branches are experiments. Tags are releases.<br />Everything else is commentary.</sub>
</p>
