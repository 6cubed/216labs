import os
import pathlib
import logging
from datetime import datetime, timezone

import google.auth.transport.requests
import requests
from cachecontrol import CacheControl
from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from apscheduler.schedulers.background import BackgroundScheduler

from database import get_db, init_db, calculate_points_for_fixture
from scraper import sync_fixtures, sync_results, get_active_gameweek_number

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("BIGLEROYS_SECRET_KEY", "dev-secret-change-me")

if os.environ.get("FLASK_ENV") != "production":
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

CLIENT_SECRETS_FILE = os.environ.get(
    "BIGLEROYS_GOOGLE_CLIENT_SECRETS_FILE",
    os.path.join(pathlib.Path(__file__).parent, "client_secret.json"),
)
OAUTH_REDIRECT_URI = os.environ.get(
    "BIGLEROYS_OAUTH_REDIRECT_URI",
    "http://localhost:8011/callback",
)
GOOGLE_CLIENT_ID = os.environ.get("BIGLEROYS_GOOGLE_CLIENT_ID", "")

SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]

_DB_INITIALIZED = False


# ── DB helpers ──────────────────────────────────────────────────────────────

def get_request_db():
    if "db" not in g:
        g.db = get_db()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db:
        db.close()


@app.before_request
def ensure_db():
    global _DB_INITIALIZED
    if not _DB_INITIALIZED:
        init_db()
        _DB_INITIALIZED = True


# ── Auth helpers ─────────────────────────────────────────────────────────────

def build_flow(state=None):
    if not os.path.exists(CLIENT_SECRETS_FILE):
        raise RuntimeError(
            "Google OAuth client_secret.json is missing. "
            "Set BIGLEROYS_GOOGLE_CLIENT_SECRETS_FILE or mount client_secret.json."
        )
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=state,
        redirect_uri=OAUTH_REDIRECT_URI,
    )


def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if "google_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)

    return decorated


def nickname_required(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if "google_id" not in session:
            return redirect(url_for("login"))
        db = get_request_db()
        user = db.execute(
            "SELECT nickname FROM users WHERE google_id = ?", (session["google_id"],)
        ).fetchone()
        if not user or not user["nickname"]:
            return redirect(url_for("set_nickname"))
        return f(*args, **kwargs)

    return decorated


def _now_utc():
    return datetime.now(tz=timezone.utc)


def _parse_dt(val) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            dt = datetime.strptime(str(val), fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if "google_id" not in session:
        return render_template("login.html")

    db = get_request_db()
    user = db.execute(
        "SELECT * FROM users WHERE google_id = ?", (session["google_id"],)
    ).fetchone()

    if not user or not user["nickname"]:
        return redirect(url_for("set_nickname"))

    # Current active gameweek
    active_gw = get_active_gameweek_number(db)
    gw_number = request.args.get("gw", active_gw, type=int)

    gameweeks = db.execute(
        "SELECT number FROM gameweeks ORDER BY number ASC"
    ).fetchall()
    gw_numbers = [g["number"] for g in gameweeks]

    gw_row = db.execute(
        "SELECT * FROM gameweeks WHERE number = ?", (gw_number,)
    ).fetchone() if gw_number else None

    fixtures = []
    locked = False

    if gw_row:
        lock_time = _parse_dt(gw_row["lock_time"])
        locked = lock_time and _now_utc() >= lock_time

        raw_fixtures = db.execute(
            """SELECT f.*, 
               p.prediction AS my_prediction,
               pa.points AS my_points
               FROM fixtures f
               LEFT JOIN predictions p ON p.fixture_id = f.id AND p.user_id = ?
               LEFT JOIN point_awards pa ON pa.fixture_id = f.id AND pa.user_id = ?
               WHERE f.gameweek_id = ?
               ORDER BY f.kickoff ASC""",
            (user["id"], user["id"], gw_row["id"]),
        ).fetchall()

        for fx in raw_fixtures:
            # Prediction counts for all users (shown when locked or result known)
            counts = db.execute(
                """SELECT prediction, COUNT(*) AS cnt FROM predictions
                   WHERE fixture_id = ? GROUP BY prediction""",
                (fx["id"],),
            ).fetchall()
            count_map = {r["prediction"]: r["cnt"] for r in counts}
            total_preds = sum(count_map.values())

            fixtures.append(
                {
                    "id": fx["id"],
                    "home_team": fx["home_team"],
                    "away_team": fx["away_team"],
                    "kickoff": _parse_dt(fx["kickoff"]),
                    "status": fx["status"],
                    "result": fx["result"],
                    "home_score": fx["home_score"],
                    "away_score": fx["away_score"],
                    "my_prediction": fx["my_prediction"],
                    "my_points": fx["my_points"],
                    "count_H": count_map.get("H", 0),
                    "count_A": count_map.get("A", 0),
                    "count_D": count_map.get("D", 0),
                    "total_preds": total_preds,
                }
            )

        # Update lock_time display
        lock_dt = lock_time

    return render_template(
        "index.html",
        user=user,
        fixtures=fixtures,
        gw_number=gw_number,
        active_gw=active_gw,
        gw_numbers=gw_numbers,
        locked=locked,
        lock_time=_parse_dt(gw_row["lock_time"]) if gw_row else None,
        now=_now_utc(),
    )


@app.route("/predict", methods=["POST"])
@nickname_required
def predict():
    fixture_id = request.form.get("fixture_id", type=int)
    prediction = request.form.get("prediction")
    gw = request.form.get("gw", type=int)

    if not fixture_id or prediction not in ("H", "A", "D"):
        flash("Invalid prediction.")
        return redirect(url_for("index", gw=gw))

    db = get_request_db()
    user = db.execute(
        "SELECT id FROM users WHERE google_id = ?", (session["google_id"],)
    ).fetchone()

    # Check lock
    fx = db.execute(
        "SELECT f.id, gw.lock_time FROM fixtures f JOIN gameweeks gw ON gw.id = f.gameweek_id WHERE f.id = ?",
        (fixture_id,),
    ).fetchone()
    if not fx:
        abort(404)

    lock_time = _parse_dt(fx["lock_time"])
    if lock_time and _now_utc() >= lock_time:
        flash("Predictions are locked for this gameweek.")
        return redirect(url_for("index", gw=gw))

    db.execute(
        """INSERT INTO predictions (user_id, fixture_id, prediction) VALUES (?, ?, ?)
           ON CONFLICT(user_id, fixture_id) DO UPDATE SET prediction = excluded.prediction""",
        (user["id"], fixture_id, prediction),
    )
    db.commit()

    return redirect(url_for("index", gw=gw))


@app.route("/leaderboard")
def leaderboard():
    db = get_request_db()

    rows = db.execute(
        """SELECT u.nickname, u.email,
               COALESCE(SUM(pa.points), 0) AS total_points,
               COUNT(pa.id) AS correct_predictions
           FROM users u
           LEFT JOIN point_awards pa ON pa.user_id = u.id
           WHERE u.nickname IS NOT NULL
           GROUP BY u.id
           ORDER BY total_points DESC""",
    ).fetchall()

    # Gameweek breakdown for each user (most recent 5 GWs with results)
    gws_with_results = db.execute(
        """SELECT DISTINCT gw.number FROM gameweeks gw
           JOIN fixtures f ON f.gameweek_id = gw.id
           WHERE f.result IS NOT NULL
           ORDER BY gw.number DESC LIMIT 5"""
    ).fetchall()
    gw_nums = [r["number"] for r in gws_with_results][::-1]

    breakdown = {}
    for row in rows:
        user_row = db.execute(
            "SELECT id FROM users WHERE nickname = ?", (row["nickname"],)
        ).fetchone()
        if not user_row:
            continue
        uid = user_row["id"]
        breakdown[row["nickname"]] = {}
        for gwn in gw_nums:
            pts = db.execute(
                """SELECT COALESCE(SUM(pa.points), 0) AS pts
                   FROM point_awards pa
                   JOIN fixtures f ON f.id = pa.fixture_id
                   JOIN gameweeks gw ON gw.id = f.gameweek_id
                   WHERE pa.user_id = ? AND gw.number = ?""",
                (uid, gwn),
            ).fetchone()
            breakdown[row["nickname"]][gwn] = round(pts["pts"], 2) if pts else 0.0

    me = None
    if "google_id" in session:
        me_row = db.execute(
            "SELECT nickname FROM users WHERE google_id = ?", (session["google_id"],)
        ).fetchone()
        if me_row:
            me = me_row["nickname"]

    return render_template(
        "leaderboard.html",
        rows=rows,
        gw_nums=gw_nums,
        breakdown=breakdown,
        me=me,
    )


@app.route("/nickname", methods=["GET"])
def set_nickname():
    if "google_id" not in session:
        return redirect(url_for("login"))
    return render_template("nickname.html", name=session.get("name", ""))


@app.route("/nickname", methods=["POST"])
def save_nickname():
    if "google_id" not in session:
        return redirect(url_for("login"))

    nickname = request.form.get("nickname", "").strip()
    if not nickname or len(nickname) < 2 or len(nickname) > 30:
        flash("Nickname must be between 2 and 30 characters.")
        return redirect(url_for("set_nickname"))

    # Sanitise: alphanumeric + spaces + hyphens
    import re
    if not re.match(r"^[\w\s\-]+$", nickname):
        flash("Nickname can only contain letters, numbers, spaces and hyphens.")
        return redirect(url_for("set_nickname"))

    db = get_request_db()
    taken = db.execute(
        "SELECT id FROM users WHERE nickname = ? AND google_id != ?",
        (nickname, session["google_id"]),
    ).fetchone()
    if taken:
        flash("That nickname is already taken, please choose another.")
        return redirect(url_for("set_nickname"))

    db.execute(
        "UPDATE users SET nickname = ? WHERE google_id = ?",
        (nickname, session["google_id"]),
    )
    db.commit()
    session["nickname"] = nickname
    return redirect(url_for("index"))


@app.route("/login")
def login():
    try:
        flow = build_flow()
    except RuntimeError as err:
        flash(str(err))
        return redirect(url_for("index"))
    auth_url, state = flow.authorization_url(prompt="select_account")
    session["oauth_state"] = state
    return redirect(auth_url)


@app.route("/callback")
def callback():
    state = session.get("oauth_state")
    if not state or state != request.args.get("state"):
        abort(400)

    try:
        flow = build_flow(state=state)
        flow.fetch_token(authorization_response=request.url)
    except Exception as exc:
        logger.error("OAuth token fetch failed: %s", exc)
        flash("Login failed. Please try again.")
        return redirect(url_for("index"))

    credentials = flow.credentials
    req_session = requests.session()
    cached_session = CacheControl(req_session)
    token_request = google.auth.transport.requests.Request(session=cached_session)

    try:
        id_info = id_token.verify_oauth2_token(
            id_token=credentials._id_token,
            request=token_request,
            audience=GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        logger.error("ID token verification failed: %s", exc)
        flash("Login failed. Please try again.")
        return redirect(url_for("index"))

    google_id = id_info["sub"]
    email = id_info.get("email", "")
    name = id_info.get("name", email)

    db = get_request_db()
    db.execute(
        """INSERT INTO users (google_id, email) VALUES (?, ?)
           ON CONFLICT(google_id) DO UPDATE SET email = excluded.email""",
        (google_id, email),
    )
    db.commit()

    session["google_id"] = google_id
    session["name"] = name
    session["email"] = email

    user = db.execute(
        "SELECT nickname FROM users WHERE google_id = ?", (google_id,)
    ).fetchone()
    if not user or not user["nickname"]:
        return redirect(url_for("set_nickname"))

    session["nickname"] = user["nickname"]
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/admin/sync")
def admin_sync():
    """Manual sync trigger (no auth for simplicity on a private VPS)."""
    db = get_db()
    try:
        f = sync_fixtures(db)
        r = sync_results(db)
        return f"Synced {f} new fixtures, updated {r} results."
    finally:
        db.close()


# ── Background scheduler ─────────────────────────────────────────────────────

def _run_sync():
    logger.info("Scheduled sync starting…")
    try:
        init_db()
        db = get_db()
        try:
            sync_fixtures(db)
            sync_results(db)
        finally:
            db.close()
    except Exception as exc:
        logger.error("Scheduled sync error: %s", exc)


def start_scheduler():
    scheduler = BackgroundScheduler(daemon=True)
    # Sync fixtures once a day at 07:00 UTC
    scheduler.add_job(_run_sync, "cron", hour=7, minute=0, id="daily_sync")
    # Check for new results every 30 minutes during the day
    scheduler.add_job(
        lambda: (
            init_db(),
            (lambda db: (sync_results(db), db.close()))(get_db()),
        ),
        "interval",
        minutes=30,
        id="result_poll",
    )
    scheduler.start()
    logger.info("Scheduler started.")
    # Run immediately on startup
    _run_sync()


# ── Template filters ──────────────────────────────────────────────────────────

@app.template_filter("datefmt")
def datefmt(dt, fmt="%a %d %b %H:%M"):
    if not dt:
        return "TBC"
    if isinstance(dt, str):
        dt = _parse_dt(dt)
    if not dt:
        return "TBC"
    return dt.strftime(fmt)


@app.template_filter("pct")
def pct(count, total):
    if not total:
        return 0
    return round(100 * count / total)


if __name__ == "__main__":
    init_db()
    start_scheduler()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
