from pathlib import Path
import os

from flask import Flask, jsonify, render_template

from shirt_creation.generate_daily_drop import (
    generate_or_load_daily_drop,
    load_drop_data,
)

app = Flask(__name__)
app.debug = os.getenv("FLASK_DEBUG", "0") == "1"
DATA_FILE = Path(__file__).resolve().parent / "data" / "daily_drop.json"


def _generate() -> dict:
    return generate_or_load_daily_drop(
        data_file=DATA_FILE,
        openai_api_key=os.getenv("AGITSHIRTS_OPENAI_API_KEY"),
        checkout_base_url=os.getenv("AGITSHIRTS_CHECKOUT_BASE_URL", ""),
        model=os.getenv("AGITSHIRTS_MODEL", "gpt-4o-mini"),
    )


@app.route("/")
def index():
    data = _generate()
    drop = data.get("drop", {})
    return render_template(
        "index.html",
        drop=drop,
        meta=data.get("meta", {}),
        history=data.get("history", []),
    )


@app.route("/api/daily-drop")
def daily_drop():
    return jsonify(_generate())


@app.route("/tasks/generate_daily_drop")
def task_generate_daily_drop():
    return jsonify(_generate())


@app.route("/healthz")
def healthz():
    data = load_drop_data(DATA_FILE)
    return jsonify(
        {
            "ok": True,
            "has_drop": bool(data.get("drop")),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
