# MaxLearn

Tinder for Wikipedia rabbit holes. Swipe through snippets; like one and we add 10 related articles to your feed. Your likes steer the algorithm so you see more of what you’re into.

## Seed the database (10k snippets)

Run once to fill the pool with ~10k Wikipedia snippets (random + category diversity):

```bash
# From repo root, with data dir writable (e.g. after first run of the app)
MAXLEARN_DATA_DIR=./apps/maxlearn/data python3 apps/maxlearn/seed_wikipedia.py
```

Or inside the container after deploy:

```bash
docker compose exec maxlearn python /app/seed_wikipedia.py
```

Seeding takes a while (rate-limited requests to Wikipedia). When done, the app will have plenty of cards to serve and will add 10 neighbours per like on the fly.
