from pathlib import Path
import sys
import os

from flask import Flask, jsonify, render_template

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from meme_creation.create_batch_of_memes import create_daily_meme_batch, load_generated_memes

app = Flask(__name__)
app.debug = os.getenv("FLASK_DEBUG", "0") == "1"
DATA_FILE = Path(__file__).resolve().parent / "data" / "generated_memes.json"


@app.route("/tasks/meme_creation")
def meme_creation():
    result = create_daily_meme_batch(
        data_file=DATA_FILE,
        limit=5,
        news_api_key=os.getenv("NEWS_API_KEY"),
        imgflip_username=os.getenv("IMG_FLIP_USERNAME"),
        imgflip_password=os.getenv("IMG_FLIP_PASSWORD"),
    )
    return jsonify(result)


@app.route("/")
def index():
    data = load_generated_memes(DATA_FILE)
    memes = data.get("memes", [])
    meta = data.get("meta", {})
    return render_template(
        "index.html",
        memes=memes,
        meta=meta,
        meme_count=len(memes),
    )


@app.route("/config.json")
def config():
    return jsonify(
        {
            "news_api_key": os.getenv("NEWS_API_KEY"),
            "imgflip_username": os.getenv("IMG_FLIP_USERNAME"),
            "imgflip_password": os.getenv("IMG_FLIP_PASSWORD"),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
