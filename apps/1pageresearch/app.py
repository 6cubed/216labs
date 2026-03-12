import json
import os
import re

import requests
import stripe
from flask import Flask, Response, render_template, request, stream_with_context

from database import (
    get_all_reports,
    get_report_by_slug,
    get_paid_request_by_session,
    get_pending_free_requests,
    get_free_request,
    init_db,
    insert_report,
    insert_paid_request,
    insert_free_request,
    update_paid_request_done,
    update_free_request_approved,
    update_free_request_denied,
)

app = Flask(__name__)

OPENROUTER_API_KEY = os.environ.get("ONEPAGE_OPENROUTER_API_KEY", "")
MODEL = os.environ.get("ONEPAGE_MODEL", "google/gemini-2.0-flash-001")
OPENAI_MODEL_USER = os.environ.get("ONEPAGE_OPENAI_MODEL", "gpt-4o-mini")
STRIPE_SECRET_KEY = os.environ.get("ONEPAGE_STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("ONEPAGE_STRIPE_WEBHOOK_SECRET", "")
ONEPAGE_ADMIN_SECRET = os.environ.get("ONEPAGE_ADMIN_SECRET", "")
BASE_URL = os.environ.get("ONEPAGE_BASE_URL", "https://1pageresearch.agimemes.com")
DB_INITIALIZED = False

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

AGENT_SYSTEM_PROMPT = """You are a research analyst that mines internet community data for statistically significant effects and writes concise, rigorous 1-page research reports.

You will be given a topic. Produce a JSON object (no markdown fences, raw JSON only) with this exact schema:

{
  "slug": "kebab-case-unique-id",
  "title": "Full descriptive title",
  "intervention": "Specific intervention or exposure",
  "outcome": "Specific measured outcome",
  "source_communities": "r/subreddit1, r/subreddit2, ...",
  "sample_size": <integer>,
  "effect_summary": "One sentence summary of the main finding",
  "p_value": <float or null>,
  "p_value_display": "< 0.001 or exact",
  "effect_size": <float or null>,
  "effect_size_label": "Cohen's h / d / OR / RR etc.",
  "confidence_interval": "XX% – XX% (95% CI)",
  "stats": [
    {"metric": "...", "value": "...", "notes": "..."},
    ...
  ],
  "report_markdown": "Full 1-page report in markdown...",
  "tags": "comma,separated,tags"
}

The report_markdown must include: Background, Data & Methods, Results (with a markdown table), Discussion, Limitations, Conclusion.
Use plausible but clearly labelled observational figures — note any figures are model-estimated from known community discourse patterns.
All statistical tests must be named. Effect sizes must be labelled."""


@app.before_request
def before_request():
    global DB_INITIALIZED
    if not DB_INITIALIZED:
        init_db()
        DB_INITIALIZED = True


@app.route("/")
def index():
    reports = get_all_reports()
    return render_template("index.html", reports=reports)


@app.route("/report/<slug>")
def report(slug):
    r = get_report_by_slug(slug)
    if r is None:
        return render_template("404.html"), 404
    return render_template("report.html", report=r)


def _platform_api_config():
    """Return (api_url, api_headers, api_model) for platform key, or None if not configured."""
    if OPENROUTER_API_KEY:
        return (
            "https://openrouter.ai/api/v1/chat/completions",
            {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://216labs.com",
                "X-Title": "1PageResearch",
            },
            MODEL,
        )
    return None


@app.route("/generate", methods=["GET"])
def generate_page():
    return render_template(
        "generate.html",
        stripe_configured=bool(STRIPE_SECRET_KEY),
        base_url=BASE_URL,
    )


@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    """Create Stripe Checkout session for €1 report. Topic required."""
    if not STRIPE_SECRET_KEY:
        return {"error": "Stripe is not configured"}, 503
    body = request.json or {}
    topic = (body.get("topic") or "").strip()
    if not topic:
        return {"error": "Topic required"}, 400
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": 100,
                        "product_data": {
                            "name": "1PageResearch report",
                            "description": f"One AI-generated 1-page research report: {topic[:80]}{'…' if len(topic) > 80 else ''}",
                        },
                    },
                    "quantity": 1,
                }
            ],
            metadata={"topic": topic[:500]},
            success_url=f"{BASE_URL}/generate?paid=1&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{BASE_URL}/generate?cancelled=1",
        )
        insert_paid_request(session.id, topic)
        return {"url": session.url}
    except stripe.error.StripeError as e:
        return {"error": str(e)}, 400


@app.route("/api/webhook/stripe", methods=["POST"])
def api_stripe_webhook():
    """Stripe webhook: checkout.session.completed. We verify payment on generate-paid; no heavy work here."""
    if not STRIPE_WEBHOOK_SECRET:
        return {"error": "Webhook secret not set"}, 500
    sig = request.headers.get("Stripe-Signature", "")
    payload = request.get_data(as_text=False)
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError:
        return {"error": "Invalid signature"}, 400
    if event.type == "checkout.session.completed":
        pass
    return {"received": True}


@app.route("/api/paid-session", methods=["GET"])
def api_paid_session():
    """Verify Stripe session and return topic so frontend can start generate-paid."""
    session_id = (request.args.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id required"}, 400
    if not STRIPE_SECRET_KEY:
        return {"error": "Stripe not configured"}, 503
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.InvalidRequestError:
        return {"error": "Invalid session"}, 404
    if session.payment_status != "paid":
        return {"paid": False, "error": "Not paid"}, 402
    topic = (session.metadata or {}).get("topic") or ""
    row = get_paid_request_by_session(session_id)
    if not row:
        return {"error": "Session not found in DB"}, 404
    topic = topic or row.get("topic") or ""
    return {"paid": True, "topic": topic, "session_id": session_id}


@app.route("/api/generate-paid", methods=["POST"])
def api_generate_paid():
    """Stream report generation for a paid session. Uses platform key."""
    body = request.json or {}
    session_id = (body.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id required"}, 400
    platform = _platform_api_config()
    if not platform:
        return {"error": "Platform API key not configured"}, 503
    if STRIPE_SECRET_KEY:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status != "paid":
                return {"error": "Payment not completed"}, 402
        except stripe.error.InvalidRequestError:
            return {"error": "Invalid session"}, 404
    row = get_paid_request_by_session(session_id)
    if not row:
        return {"error": "Session not found"}, 404
    if row.get("report_slug"):
        return Response(
            f"data: {json.dumps({'done': True, 'slug': row['report_slug']})}\n\n",
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    topic = row.get("topic") or ""
    if not topic:
        return {"error": "Topic missing"}, 400
    api_url, api_headers, api_model = platform

    def stream():
        try:
            resp = requests.post(
                api_url,
                headers=api_headers,
                json={
                    "model": api_model,
                    "messages": [
                        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Write a 1-page research report on: {topic}"},
                    ],
                    "stream": True,
                },
                stream=True,
                timeout=120,
            )
            resp.raise_for_status()
            full_text = ""
            for line in resp.iter_lines():
                if not line:
                    continue
                line = line.decode("utf-8")
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    content = chunk["choices"][0]["delta"].get("content", "")
                    if content:
                        full_text += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
            try:
                clean = re.sub(r"^```[a-z]*\n?|```$", "", full_text.strip(), flags=re.MULTILINE).strip()
                report_data = json.loads(clean)
                insert_report(report_data)
                update_paid_request_done(session_id, report_data.get("slug", ""))
                yield f"data: {json.dumps({'done': True, 'slug': report_data.get('slug', '')})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'done': True, 'error': str(e), 'raw': full_text[:500]})}\n\n"
        except requests.RequestException as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/request-free", methods=["POST"])
def api_request_free():
    """Submit a free report request for admin approval."""
    body = request.json or {}
    topic = (body.get("topic") or "").strip()
    if not topic:
        return {"error": "Topic required"}, 400
    rid = insert_free_request(topic)
    return {"id": rid, "message": "Request submitted. An admin will review it; you can check back later."}


@app.route("/admin/requests")
def admin_requests():
    """List pending free requests. Protected by ONEPAGE_ADMIN_SECRET (query param or header)."""
    secret = request.args.get("admin_secret") or request.headers.get("X-Admin-Secret") or ""
    if not ONEPAGE_ADMIN_SECRET or secret != ONEPAGE_ADMIN_SECRET:
        return "Unauthorized", 401
    pending = get_pending_free_requests()
    return render_template("admin_requests.html", pending=pending, base_url=BASE_URL or request.url_root.rstrip("/"))


@app.route("/api/admin/approve-request", methods=["POST"])
def api_admin_approve():
    """Approve a free request: run generation with platform key and save report."""
    body = request.json or {}
    if (body.get("admin_secret") or "") != ONEPAGE_ADMIN_SECRET:
        return {"error": "Unauthorized"}, 401
    if not ONEPAGE_ADMIN_SECRET:
        return {"error": "Admin not configured"}, 503
    request_id = body.get("request_id")
    if request_id is None:
        return {"error": "request_id required"}, 400
    req = get_free_request(int(request_id))
    if not req:
        return {"error": "Request not found"}, 404
    if req.get("status") != "pending":
        return {"error": "Request already reviewed"}, 400
    platform = _platform_api_config()
    if not platform:
        return {"error": "Platform API key not configured"}, 503
    topic = req.get("topic") or ""
    api_url, api_headers, api_model = platform
    try:
        resp = requests.post(
            api_url,
            headers=api_headers,
            json={
                "model": api_model,
                "messages": [
                    {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Write a 1-page research report on: {topic}"},
                ],
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        full_text = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    except requests.RequestException as e:
        return {"error": str(e)}, 502
    try:
        clean = re.sub(r"^```[a-z]*\n?|```$", "", full_text.strip(), flags=re.MULTILINE).strip()
        report_data = json.loads(clean)
        insert_report(report_data)
        slug = report_data.get("slug", "")
        update_free_request_approved(int(request_id), slug)
        return {"slug": slug}
    except Exception as e:
        return {"error": f"Parse failed: {e}"}, 502


@app.route("/api/admin/deny-request", methods=["POST"])
def api_admin_deny():
    body = request.json or {}
    if (body.get("admin_secret") or "") != ONEPAGE_ADMIN_SECRET:
        return {"error": "Unauthorized"}, 401
    request_id = body.get("request_id")
    if request_id is None:
        return {"error": "request_id required"}, 400
    req = get_free_request(int(request_id))
    if not req:
        return {"error": "Request not found"}, 404
    if req.get("status") != "pending":
        return {"error": "Request already reviewed"}, 400
    update_free_request_denied(int(request_id))
    return {"ok": True}


@app.route("/api/generate", methods=["POST"])
def api_generate():
    body = request.json or {}
    topic = body.get("topic", "").strip()
    user_openai_key = (body.get("openai_api_key") or "").strip()

    if not topic:
        return {"error": "No topic provided"}, 400

    # Use user's key if provided; otherwise fall back to platform OpenRouter key
    if user_openai_key:
        api_url = "https://api.openai.com/v1/chat/completions"
        api_headers = {
            "Authorization": f"Bearer {user_openai_key}",
            "Content-Type": "application/json",
        }
        api_model = OPENAI_MODEL_USER
    elif OPENROUTER_API_KEY:
        api_url = "https://openrouter.ai/api/v1/chat/completions"
        api_headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://216labs.com",
            "X-Title": "1PageResearch",
        }
        api_model = MODEL
    else:
        return {
            "error": "No API key. Paste your OpenAI API key in the field below, or ask the site owner to set ONEPAGE_OPENROUTER_API_KEY.",
        }, 400

    def stream():
        try:
            resp = requests.post(
                api_url,
                headers=api_headers,
                json={
                    "model": api_model,
                    "messages": [
                        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Write a 1-page research report on: {topic}"},
                    ],
                    "stream": True,
                },
                stream=True,
                timeout=120,
            )
            resp.raise_for_status()

            full_text = ""
            for line in resp.iter_lines():
                if not line:
                    continue
                line = line.decode("utf-8")
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    content = chunk["choices"][0]["delta"].get("content", "")
                    if content:
                        full_text += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

            # Try to parse and save the completed JSON
            try:
                # Strip any accidental markdown fences
                clean = re.sub(r"^```[a-z]*\n?|```$", "", full_text.strip(), flags=re.MULTILINE).strip()
                report_data = json.loads(clean)
                insert_report(report_data)
                yield f"data: {json.dumps({'done': True, 'slug': report_data.get('slug', '')})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'done': True, 'error': f'Parse failed: {e}', 'raw': full_text[:500]})}\n\n"

        except requests.RequestException as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
