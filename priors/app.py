import os
import pathlib

import google.auth.transport.requests
import requests
from cachecontrol import CacheControl
from flask import Flask, abort, flash, redirect, render_template, request, session, url_for
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow

from database import get_db, init_db
from llm_service import get_likelihood_of_yes

app = Flask(__name__)
app.secret_key = os.environ.get("PRIORS_SECRET_KEY", "dev-secret-change-me")

if os.environ.get("FLASK_ENV") != "production":
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

CLIENT_SECRETS_FILE = os.environ.get(
    "PRIORS_GOOGLE_CLIENT_SECRETS_FILE",
    os.path.join(pathlib.Path(__file__).parent, "client_secret.json"),
)
OAUTH_REDIRECT_URI = os.environ.get(
    "PRIORS_OAUTH_REDIRECT_URI",
    "http://localhost:8010/callback",
)
SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]
DB_INITIALIZED = False


def get_flow(state=None):
    if not os.path.exists(CLIENT_SECRETS_FILE):
        raise RuntimeError(
            "Google OAuth client secret file is missing. "
            "Set PRIORS_GOOGLE_CLIENT_SECRETS_FILE or add client_secret.json."
        )

    return Flow.from_client_secrets_file(
        client_secrets_file=CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=state,
        redirect_uri=OAUTH_REDIRECT_URI,
    )


@app.before_request
def before_request():
    global DB_INITIALIZED
    if not DB_INITIALIZED:
        init_db()
        DB_INITIALIZED = True


@app.route("/")
def index():
    if "google_id" in session:
        user_id = session["google_id"]
        db = get_db()
        priors = db.execute(
            "SELECT id, question, likelihood FROM priors WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        db.close()
        return render_template("index.html", name=session["name"], priors=priors)
    return render_template("login.html")


@app.route("/login")
def login():
    try:
        flow = get_flow()
    except RuntimeError as error:
        flash(str(error))
        return redirect(url_for("index"))

    authorization_url, state = flow.authorization_url()
    session["state"] = state
    return redirect(authorization_url)


@app.route("/callback")
def callback():
    flow = get_flow(state=session.get("state"))
    flow.fetch_token(authorization_response=request.url)

    if not session.get("state") == request.args.get("state"):
        abort(500)

    credentials = flow.credentials
    request_session = requests.session()
    cached_session = CacheControl(request_session)
    token_request = google.auth.transport.requests.Request(session=cached_session)

    id_info = id_token.verify_oauth2_token(
        id_token=credentials._id_token,
        request=token_request,
        audience=os.environ.get("GOOGLE_CLIENT_ID"),
    )

    session["google_id"] = id_info.get("sub")
    session["name"] = id_info.get("name")
    return redirect("/")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@app.route("/add_prior", methods=["POST"])
def add_prior():
    if "google_id" not in session:
        flash("Please log in to add a prior.")
        return redirect(url_for("index"))

    question = request.form["question"]
    user_id = session["google_id"]
    likelihood = get_likelihood_of_yes(question)

    db = get_db()
    db.execute(
        "INSERT INTO priors (user_id, question, likelihood) VALUES (?, ?, ?)",
        (user_id, question, likelihood),
    )
    db.commit()
    db.close()
    flash("Prior added successfully!")
    return redirect(url_for("index"))


@app.route("/delete_prior/<int:prior_id>")
def delete_prior(prior_id):
    if "google_id" not in session:
        flash("Please log in to delete a prior.")
        return redirect(url_for("index"))

    user_id = session["google_id"]
    db = get_db()
    cursor = db.execute(
        "DELETE FROM priors WHERE id = ? AND user_id = ?",
        (prior_id, user_id),
    )
    db.commit()
    db.close()

    if cursor.rowcount == 0:
        flash("Prior not found or you don't have permission to delete it.")
    else:
        flash("Prior deleted successfully!")
    return redirect(url_for("index"))


@app.cli.command("initdb")
def initdb_command():
    init_db()
    print("Initialized the database.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
