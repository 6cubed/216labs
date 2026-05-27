# StoryMagic — paid traffic playbook (CEO)

**Product:** https://storybook.6cubed.app — AI kids’ storybook preview, **$24.99** print when Stripe is on.

**Funnel today:** Generate preview → **waitlist** (email) when checkout is off → **Stripe Checkout** when keys are set.

**Leads in admin:** Admin → **Leads** (print-interest ingest). No scripts required.

---

## Before you spend on ads

| Gate | Where |
|------|--------|
| Site loads | https://storybook.6cubed.app |
| GA4 on host | `GA_MEASUREMENT_ID` in manifest / env (pageviews already) |
| Conversion events | Shipped in app — see **GA4 events** below |
| Stripe (optional for Path B) | [admin → Env](https://admin.6cubed.app/env) — `STORYBOOK_STRIPE_*` — see [`FIRST-SALE.md`](FIRST-SALE.md) |

**Path A — Waitlist ads (now):** Run Meta/TikTok to preview + waitlist. Measure **waitlist_signup** CPA.

**Path B — Purchase ads (after keys):** Same creative, optimize for **begin_checkout** / **purchase**. Better revenue signal.

---

## GA4 events (mark as conversions in GA4)

| Event | When |
|-------|------|
| `generate_start` | User starts generation |
| `story_preview_ready` | Full illustrated preview shown |
| `waitlist_signup` | Email saved (checkout off) |
| `begin_checkout` | Redirect to Stripe |
| `purchase` | Success page after payment |

In **GA4 → Admin → Events**, mark `waitlist_signup` (Path A) or `purchase` (Path B) as **conversions**. Use **Explorations** or **Advertising** reports for campaign UTMs.

**UTM example:** `?utm_source=meta&utm_medium=paid&utm_campaign=storymagic_may26`

UTMs are **stored on each waitlist lead** (session first-touch) and shown in [admin → Orders](https://admin.6cubed.app/orders) under StoryMagic print leads — no scripts required to see which ad drove an email.

---

## Meta (recommended first test)

1. **Business Manager** → Ad account linked to a Page.
2. **Campaign:** Leads or Sales (Path A vs B), **$15–25/day** for 5–7 days.
3. **Creative:** 15–30s screen recording — type topic → watch pages illustrate → waitlist or Order CTA. UGC voiceover beats polished brand for parents.
4. **Audience:** Parents 25–45, interests: parenting, children’s books, personalized gifts (US/UK/IE to start).
5. **Landing:** storybook URL with UTMs; do not send to homepage.

**Success (Path A):** waitlist CPA under ~$8–12 test budget; ≥30% preview completion rate (`story_preview_ready` / `generate_start`).

**Success (Path B):** ROAS or cost per `purchase` after Stripe live.

---

## What engineering does vs CEO

| CEO | Team / admin |
|-----|----------------|
| Budget, creative, Meta account | Stripe keys, Save on admin Env |
| Pick Path A or B | `./scripts/check-revenue-env-http.sh` after Save |
| Mark GA4 conversions | Deploy only if Save did not recreate storybook |

---

## Blockers

| Blocker | Next move |
|---------|-----------|
| No Stripe keys | Paste test keys in [admin Env](https://admin.6cubed.app/env) → Save → verify checkout |
| No GA4 ID on storybook host | Set `GA_MEASUREMENT_ID` in admin Env for `storybook` app |
| Ads with no measurement | Enable conversions above + UTMs on every ad link |
