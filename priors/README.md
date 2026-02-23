# Priors

Flask app for tracking yes/no priors with Google login and Gemini-assisted likelihood suggestions.

## Local run

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export FLASK_APP=app.py
export PORT=5000
flask run
```

Set these environment variables first:

- `PRIORS_SECRET_KEY`
- `PRIORS_OAUTH_REDIRECT_URI`
- `PRIORS_GOOGLE_CLIENT_ID`
- `PRIORS_GEMINI_API_KEY`

Also place your Google OAuth client credentials JSON at `priors/client_secret.json`.

## Docker

The app is wired into the monorepo stack on `:8010` through Caddy.
