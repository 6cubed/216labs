# Bridge federation — many machines, one Telegram group

## Rule (Telegram API)

**One bot token → one `getUpdates` poller.** Two processes using the same `TELEGRAM_BOT_TOKEN` will steal updates from each other. To attach more bridges to the **same group**, use **one bot per bridge** (each @BotFather bot invited to the group).

## Recommended layout

| Bridge | Machine | Bot | CDP port | State dir |
|--------|---------|-----|----------|-----------|
| `main` | Your laptop | `@YourMainBot` | 9222 (auto) | `pocket-cursor-bridge/` |
| `studio` | Second Mac / VM | `@StudioBot` | 9223+ | `pocket-cursor-bridge-instances/studio/` |
| `server` | Linux box | `@ServerBot` | 9224+ | `pocket-cursor-bridge-instances/server/` |

Outbound messages are prefixed with `[instance-id]` when `POCKET_BRIDGE_INSTANCE_ID` is set so the group can tell who replied.

## Spawn a new bridge (same repo)

From repo root:

```bash
./scripts/spawn-pocket-bridge.sh studio
```

1. Edit `internal/admin/pocket-cursor-bridge-instances/studio/.env` — **paste a new bot token** (not the main bridge’s token).
2. Add that bot to your Telegram group (same group as the main bridge is fine).
3. Start:

```bash
POCKET_BRIDGE_DATA_DIR=internal/admin/pocket-cursor-bridge-instances/studio \
  ./scripts/pocket-cursor-bridge.sh
```

Optional in `.env`:

- `POCKET_BRIDGE_INSTANCE_ID=studio` — Telegram prefix (set by spawn script).
- `POCKET_CDP_PORT=9225` — dedicated Cursor CDP port (spawn script picks a stable offset).
- `TELEGRAM_ALLOWED_USER_IDS` — same family group allowlist as the main bridge.

## Self-replication (roadmap)

| Phase | What |
|-------|------|
| **Now** | Spawn script + isolated state dir + instance label + docs |
| **Next** | `/spawn` Telegram command prints spawn instructions + instance list |
| **Later** | Droplet **webhook hub** — one HTTPS endpoint, route updates to N registered bridge URLs (no polling on laptops) |
| **Later** | Optional **forum topic** per instance in a supergroup (single bot, thread per machine) |

## Same machine, two Cursor workspaces

You already get multiple **Cursor instances** on one bridge (`/chats`, instance registry). Federation is for **separate processes** (separate bots, separate `pocket_cursor.py` PIDs), not duplicate pollers on one token.

## Ops checklist

1. New bot via [@BotFather](https://t.me/BotFather) → `/newbot`
2. Bot added to target group with permission to read messages
3. Unique `POCKET_BRIDGE_DATA_DIR` per running bridge
4. `python start_cursor.py --port <POCKET_CDP_PORT>` or set `POCKET_CDP_PORT` in instance `.env`
5. `TELEGRAM_OWNER_ID` / `TELEGRAM_ALLOWED_USER_IDS` synced from admin Env or copied into instance `.env`
