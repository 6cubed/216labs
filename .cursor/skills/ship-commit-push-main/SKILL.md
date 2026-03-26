---
name: ship-commit-push-main
description: >-
  After completing code or infrastructure changes in this repo, commits with a
  clear message and pushes to main so CI (e.g. GHCR) can run. Use when finishing
  a task, when the user asks to commit/push/ship, or when workspace rules require
  leaving no uncommitted work for shipped changes.
---

# Ship: commit and push to `main`

## When to apply

- At the end of any task that changes tracked app or infra files in this repository.
- Whenever the user says to commit, push, ship, or merge to main.

## Workflow

1. **Review** `git status`. Stage only files that belong to the completed work (do not add secrets, `.env*`, local bridge logs, or unrelated WIP unless the user explicitly bundles them).
2. **Commit** with a message that states what changed and why, in one short subject line plus optional body (imperative mood, e.g. "Add workforce admin app and Caddy route").
3. **Push** to `main`: `git push origin main`
4. If push fails (behind remote), `git pull --rebase origin main` then push again unless the user prefers merge.

## Scope

- Default branch is **`main`** for this project.
- Routine shipping: push triggers GitHub Actions (e.g. image publish); droplet deploy may follow separately unless the user asks for `./deploy.sh` in that message.

## Do not

- Commit files that are gitignored for good reason or contain local secrets.
- Leave the task "done" with only local commits and no push when the user expects shipping.
