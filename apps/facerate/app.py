import os

from flask import Flask, jsonify, render_template, request, send_from_directory

from database import (
    face_count,
    get_face_by_id,
    get_leaderboard,
    get_two_random_faces,
    init_db,
    record_vote,
)

app = Flask(__name__)

DB_INITIALIZED = False
FACES_DIR = os.environ.get("FACERATE_FACES_DIR", os.path.join(os.path.dirname(__file__), "static", "faces"))


@app.before_request
def before_request():
    global DB_INITIALIZED
    if not DB_INITIALIZED:
        init_db()
        DB_INITIALIZED = True


@app.route("/")
def index():
    return render_template("index.html", total_faces=face_count())


@app.route("/leaderboard")
def leaderboard_page():
    return render_template("leaderboard.html", faces=get_leaderboard(limit=100))


@app.route("/static/faces/<path:filename>")
def serve_face(filename):
    return send_from_directory(FACES_DIR, filename)


@app.route("/api/pair")
def api_pair():
    """Return two random faces for a vote: { face_a: { id, url, elo }, face_b: { ... } }."""
    a_id, b_id = get_two_random_faces()
    if a_id is None or b_id is None:
        return jsonify({"error": "Not enough faces in database (need at least 2)"}), 503
    face_a = get_face_by_id(a_id)
    face_b = get_face_by_id(b_id)
    return jsonify({
        "face_a": {
            "id": face_a["id"],
            "url": f"/static/faces/{face_a['filename']}",
            "elo": round(face_a["elo"], 1),
        },
        "face_b": {
            "id": face_b["id"],
            "url": f"/static/faces/{face_b['filename']}",
            "elo": round(face_b["elo"], 1),
        },
    })


@app.route("/api/vote", methods=["POST"])
def api_vote():
    """Body: { face_a_id, face_b_id, winner_id }. Updates Elo and returns new ratings."""
    body = request.json or {}
    try:
        face_a_id = int(body.get("face_a_id"))
        face_b_id = int(body.get("face_b_id"))
        winner_id = int(body.get("winner_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "face_a_id, face_b_id, winner_id required (integers)"}), 400
    try:
        result = record_vote(face_a_id, face_b_id, winner_id)
        return jsonify({"ok": True, **result})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/leaderboard")
def api_leaderboard():
    limit = min(int(request.args.get("limit", 100)), 500)
    return jsonify(get_leaderboard(limit=limit))
