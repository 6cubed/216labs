# FaceRate — vote on AI faces, Elo leaderboard (per-country, by attraction)
import os

from flask import Flask, jsonify, render_template, request, send_from_directory

from database import (
    face_count,
    get_bottom,
    get_face_by_id,
    get_leaderboard,
    get_two_random_faces,
    get_elo,
    init_db,
    record_vote,
)

app = Flask(__name__)

DB_INITIALIZED = False
FACES_DIR = os.environ.get("FACERATE_FACES_DIR", os.path.join(os.path.dirname(__file__), "static", "faces"))

# ISO 3166-1 alpha-2; subset for dropdown (can expand)
COUNTRIES = [
    ("US", "United States"), ("GB", "United Kingdom"), ("DE", "Germany"), ("FR", "France"),
    ("IE", "Ireland"), ("CA", "Canada"), ("AU", "Australia"), ("NZ", "New Zealand"),
    ("ES", "Spain"), ("IT", "Italy"), ("NL", "Netherlands"), ("SE", "Sweden"),
    ("BR", "Brazil"), ("IN", "India"), ("JP", "Japan"), ("MX", "Mexico"),
    ("PL", "Poland"), ("CH", "Switzerland"), ("AT", "Austria"), ("BE", "Belgium"),
    ("PT", "Portugal"), ("ZA", "South Africa"), ("AR", "Argentina"), ("CO", "Colombia"),
    ("XX", "Other / Prefer not to say"),
]


@app.before_request
def before_request():
    global DB_INITIALIZED
    if not DB_INITIALIZED:
        init_db()
        DB_INITIALIZED = True


@app.route("/")
def index():
    return render_template("index.html", total_faces=face_count(), countries=COUNTRIES)


@app.route("/leaderboard")
def leaderboard_page():
    country = request.args.get("country", "US")
    top = get_leaderboard(country_code=country, limit=100)
    bottom = get_bottom(country_code=country, limit=10)
    return render_template(
        "leaderboard.html",
        countries=COUNTRIES,
        selected_country=country,
        top_faces=top,
        bottom_faces=bottom,
    )


@app.route("/static/faces/<path:filename>")
def serve_face(filename):
    return send_from_directory(FACES_DIR, filename)


@app.route("/api/pair")
def api_pair():
    """Query: attraction=m|f|all, country=XX. Return two same-gender faces (or both if all)."""
    attraction = (request.args.get("attraction") or "all").strip().lower()
    if attraction not in ("m", "f", "all"):
        attraction = "all"
    country_code = (request.args.get("country") or "XX").strip()[:2].upper() or "XX"

    a_id, b_id = get_two_random_faces(attraction, country_code)
    if a_id is None or b_id is None:
        return jsonify({
            "error": "Not enough faces for this selection. Try “All” or another gender.",
        }), 503
    face_a = get_face_by_id(a_id)
    face_b = get_face_by_id(b_id)
    elo_a = get_elo(a_id, country_code)
    elo_b = get_elo(b_id, country_code)
    return jsonify({
        "face_a": {
            "id": face_a["id"],
            "url": f"/static/faces/{face_a['filename']}",
            "elo": round(elo_a, 1),
        },
        "face_b": {
            "id": face_b["id"],
            "url": f"/static/faces/{face_b['filename']}",
            "elo": round(elo_b, 1),
        },
    })


@app.route("/api/vote", methods=["POST"])
def api_vote():
    """Body: { face_a_id, face_b_id, winner_id, country_code }. Updates Elo for that country only."""
    body = request.json or {}
    try:
        face_a_id = int(body.get("face_a_id"))
        face_b_id = int(body.get("face_b_id"))
        winner_id = int(body.get("winner_id"))
        country_code = (body.get("country_code") or "XX").strip()[:2].upper() or "XX"
    except (TypeError, ValueError):
        return jsonify({"error": "face_a_id, face_b_id, winner_id, country_code required"}), 400
    try:
        result = record_vote(face_a_id, face_b_id, winner_id, country_code)
        return jsonify({"ok": True, **result})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/leaderboard")
def api_leaderboard():
    country = (request.args.get("country") or "US").strip()[:2].upper() or "US"
    limit = min(int(request.args.get("limit", 100)), 500)
    return jsonify(get_leaderboard(country_code=country, limit=limit))


@app.route("/api/leaderboard/bottom")
def api_leaderboard_bottom():
    country = (request.args.get("country") or "US").strip()[:2].upper() or "US"
    limit = min(int(request.args.get("limit", 10)), 50)
    return jsonify(get_bottom(country_code=country, limit=limit))


@app.route("/api/countries")
def api_countries():
    return jsonify([{"code": c[0], "name": c[1]} for c in COUNTRIES])
