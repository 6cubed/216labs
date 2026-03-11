# agitshirts

Daily AI-generated t-shirt concept with limited-edition checkout.

## Routes

- `/` - storefront for today's drop
- `/api/daily-drop` - JSON for today's drop
- `/tasks/generate_daily_drop` - cron-friendly generation endpoint
- `/healthz` - health check

## Environment variables

- `AGITSHIRTS_OPENAI_API_KEY` - optional; if unset, deterministic fallback is used
- `AGITSHIRTS_MODEL` - default `gpt-4o-mini`
- `AGITSHIRTS_CHECKOUT_BASE_URL` - checkout URL prefix (e.g. Stripe Payment Link)

## Local run

```bash
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000`.
