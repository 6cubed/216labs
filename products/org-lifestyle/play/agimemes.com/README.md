# AGI Memes

Public gallery at [agimemes.6cubed.app](https://agimemes.6cubed.app). It captions Imgflip templates from NewsAPI headlines.

The gallery stays empty until these **admin Env** keys are non-blank (compose maps them into the container):

- `AGIMEMES_NEWS_API_KEY`
- `AGIMEMES_IMG_FLIP_USERNAME`
- `AGIMEMES_IMG_FLIP_PASSWORD`

Generation is `GET /tasks/meme_creation` with `Authorization: Bearer <CRON_RUNNER_SECRET>`. Do **not** start this container from a heartbeat just to fill the page — it is not on the always-on allowlist. `/config.json` was removed; it used to dump those secrets.
