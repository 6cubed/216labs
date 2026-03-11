# PocketCursor — Talk to Cursor from Telegram

PocketCursor (qmHecker/pocket-cursor) is set up so you can use Cursor from your phone via Telegram.

**Clone location:** `/Users/jackcollins/projects/pocket-cursor`

## One-time setup

1. **Telegram bot** — Create a bot with [@BotFather](https://t.me/BotFather), get the token.
2. **Config** — In `pocket-cursor/.env`, set:
   ```bash
   TELEGRAM_BOT_TOKEN=your-token-here
   ```
3. **Cursor rule** — This repo’s `.cursor/rules/pocket-cursor.mdc` is already configured with the path above (restart bridge, phone outbox, voice, context monitor).

## Run the bridge

1. **Start Cursor with CDP** (so the bridge can attach):
   ```bash
   cd /Users/jackcollins/projects/pocket-cursor
   python start_cursor.py
   ```
   Or manually: `cursor --remote-debugging-port=9222` (then open this workspace).

2. **Start the bridge** (in another terminal):
   ```bash
   cd /Users/jackcollins/projects/pocket-cursor
   python -X utf8 pocket_cursor.py
   ```

3. **Pair** — In Telegram, send your bot a message (e.g. `/start`). Follow the prompts to pair.

To restart the bridge after code changes, you can say “restart pocket cursor” in Cursor; the rule runs `restart_pocket_cursor.py`.

## More

- Full docs: `/Users/jackcollins/projects/pocket-cursor/README.md`
- Commands: `/newchat`, `/chats`, `/pause`, `/play`, `/screenshot`, `/unpair`, `/start`
