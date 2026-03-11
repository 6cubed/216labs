import json
import os
import re

import requests
from flask import Flask, Response, render_template, request, stream_with_context

from database import get_all_reports, get_report_by_slug, init_db, insert_report

app = Flask(__name__)

OPENROUTER_API_KEY = os.environ.get("ONEPAGE_OPENROUTER_API_KEY", "")
MODEL = os.environ.get("ONEPAGE_MODEL", "google/gemini-2.0-flash-001")
DB_INITIALIZED = False

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


@app.route("/generate", methods=["GET"])
def generate_page():
    return render_template("generate.html")


@app.route("/api/generate", methods=["POST"])
def api_generate():
    topic = (request.json or {}).get("topic", "").strip()
    if not topic:
        return {"error": "No topic provided"}, 400
    if not OPENROUTER_API_KEY:
        return {"error": "ONEPAGE_OPENROUTER_API_KEY is not configured"}, 500

    def stream():
        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://216labs.com",
                    "X-Title": "1PageResearch",
                },
                json={
                    "model": MODEL,
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
