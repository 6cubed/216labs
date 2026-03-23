import os

from flask import Flask, abort, render_template

app = Flask(__name__)

PUBLICATIONS = [
    {
        "slug": "reactive-ai-world-models-v1",
        "title": "Reactive AI World Models v1",
        "subtitle": "Toward ambient systems that continuously learn from live context",
        "published_on": "2026-03-23",
        "authors": ["216labs Research"],
        "summary": (
            "We outline a practical architecture for reactive AI loops where perception, "
            "memory updates, and action policies run continuously under real-world latency constraints."
        ),
        "sections": [
            {
                "heading": "Abstract",
                "body": (
                    "Most deployed AI products are still request-response systems. "
                    "Ambient intelligence requires persistent world state, event-driven adaptation, "
                    "and verifiable behavior under distribution shift."
                ),
            },
            {
                "heading": "Key Claims",
                "body": (
                    "Reactive world models are most reliable when memory writes are constrained, "
                    "state transitions are observable, and adaptation policies are benchmarked "
                    "across adversarial context windows."
                ),
            },
            {
                "heading": "Research Program",
                "body": (
                    "216labs is building a stack that combines low-latency event ingestion, "
                    "tool-augmented policy loops, and publication-grade eval reports."
                ),
            },
        ],
        "citations": [
            {
                "id": "c1",
                "text": "Sutton, R. S. (2019). The Bitter Lesson.",
                "url": "http://www.incompleteideas.net/IncIdeas/BitterLesson.html",
            },
            {
                "id": "c2",
                "text": "Brohan, A. et al. (2022). RT-1: Robotics Transformer for Real-World Control at Scale.",
                "url": "https://arxiv.org/abs/2212.06817",
            },
            {
                "id": "c3",
                "text": "Team, O. et al. (2023). GPT-4 Technical Report.",
                "url": "https://arxiv.org/abs/2303.08774",
            },
        ],
    }
]


@app.route("/")
def home():
    return render_template(
        "index.html",
        publications=PUBLICATIONS,
        mission=(
            "216labs is a new AI lab pushing the frontier of SOTA reactive AI "
            "and building the first truly ambient AI world models."
        ),
    )


@app.route("/publications/<slug>")
def publication(slug: str):
    paper = next((item for item in PUBLICATIONS if item["slug"] == slug), None)
    if paper is None:
        abort(404)
    base_url = os.environ.get("LABSHQ_BASE_URL", "https://labshq.6cubed.app").rstrip("/")
    canonical_url = f"{base_url}/publications/{paper['slug']}"
    return render_template("publication.html", paper=paper, canonical_url=canonical_url)


@app.route("/healthz")
def healthz():
    return {"ok": True}
