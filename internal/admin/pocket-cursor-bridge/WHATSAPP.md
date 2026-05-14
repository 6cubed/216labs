# WhatsApp → PocketCursor (Meta Cloud API)

Inbound WhatsApp text is injected into Cursor with a `[WhatsApp]` prefix. **Replies still go to Telegram** until the monitor is extended for dual outbound.

## 1. Create the Meta app and turn on WhatsApp

1. Open **Meta for Developers**: [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. **Create app** → use case **“Other”** or **“Business”** (either works for testing).
3. In the app dashboard, add the **WhatsApp** product if it is not already there.

Official walkthrough: [Get Started — WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

## 2. Copy the values the bridge needs

In **WhatsApp → API setup** (wording may vary):

| Bridge `.env` key | Where you get it |
|-------------------|------------------|
| `WHATSAPP_WEBHOOK_APP_SECRET` | **App settings → Basic → App secret** (click “Show”) |
| `WHATSAPP_VERIFY_TOKEN` | **You invent** any long random string; paste the **same** value in Meta’s webhook “Verify token” field |
| `WHATSAPP_ALLOWED_FROM` | Your WhatsApp number in **digits only**, country code included, **no `+`** (e.g. `491234567890`). Comma-separate multiple numbers. |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | **WhatsApp → API setup → Temporary access token** (24h for dev) or a **System user** token for production |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | **WhatsApp → API setup → Phone number ID** (digits only) — required for **sending** messages via API; inbound webhook only needs the secret + verify + allowlist above |

Permanent tokens (production): [System users & access tokens](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-users-and-access-tokens)

## 3. Point Meta at your machine (HTTPS)

Meta only calls **HTTPS** webhooks. The bridge listens on **`http://127.0.0.1:8792/webhook`** by default.

1. Start a tunnel, e.g. `ngrok http 8792` → you get `https://abcd.ngrok-free.app`
2. In **WhatsApp → Configuration → Webhook**, set **Callback URL** to  
   `https://abcd.ngrok-free.app/webhook`  
   and **Verify token** to the same string as `WHATSAPP_VERIFY_TOKEN`.
3. **Subscribe** to the **messages** field for your webhook.

## 4. Write config and restart

From repo root:

```bash
./scripts/pocket-cursor-bridge.sh --whatsapp
```

That runs the interactive wizard (writes `internal/admin/pocket-cursor-bridge/.env`). Then start the bridge normally:

```bash
./scripts/pocket-cursor-bridge.sh
```

Or set the same keys in `.env` / admin env sync and restart.

## 5. Sanity check

Send a normal WhatsApp text to your **business test number** from the allowlisted phone. You should see a line in Cursor like:

`[Thu 2026-05-14 12:53] [WhatsApp] hello`

If nothing arrives: confirm tunnel is up, Meta webhook shows **Verified**, and `WHATSAPP_ALLOWED_FROM` matches the sender id (digits only).
