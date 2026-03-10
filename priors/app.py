import os
import uuid

from flask import Flask, flash, redirect, render_template, request, session, url_for

from database import get_db, init_db
from llm_service import get_likelihood_of_yes

app = Flask(__name__)
app.secret_key = os.environ.get("PRIORS_SECRET_KEY", "dev-secret-change-me")

DB_INITIALIZED = False


@app.before_request
def before_request():
    global DB_INITIALIZED
    if not DB_INITIALIZED:
        init_db()
        DB_INITIALIZED = True
    # Assign a persistent anonymous session ID on first visit
    if "user_id" not in session:
        session["user_id"] = str(uuid.uuid4())
        session.permanent = True


@app.route("/")
def index():
    db = get_db()
    priors = db.execute(
        "SELECT id, question, likelihood, user_id, author_name FROM priors ORDER BY created_at DESC",
    ).fetchall()
    db.close()
    name = session.get("name", "")
    user_id = session["user_id"]
    return render_template("index.html", name=name, priors=priors, user_id=user_id)


@app.route("/set_name", methods=["POST"])
def set_name():
    name = request.form.get("name", "").strip()[:50]
    if name:
        session["name"] = name
    else:
        session.pop("name", None)
    return redirect(url_for("index"))


@app.route("/add_prior", methods=["POST"])
def add_prior():
    question = request.form.get("question", "").strip()
    if not question:
        flash("Question cannot be empty.")
        return redirect(url_for("index"))

    user_id = session["user_id"]
    author_name = session.get("name") or None
    likelihood = get_likelihood_of_yes(question)

    db = get_db()
    db.execute(
        "INSERT INTO priors (user_id, author_name, question, likelihood) VALUES (?, ?, ?, ?)",
        (user_id, author_name, question, likelihood),
    )
    db.commit()
    db.close()
    return redirect(url_for("index"))


@app.route("/delete_prior/<int:prior_id>", methods=["POST"])
def delete_prior(prior_id):
    user_id = session["user_id"]
    db = get_db()
    cursor = db.execute(
        "DELETE FROM priors WHERE id = ? AND user_id = ?",
        (prior_id, user_id),
    )
    db.commit()
    db.close()

    if cursor.rowcount == 0:
        flash("Not found or you don't own this question.")
    return redirect(url_for("index"))


@app.cli.command("initdb")
def initdb_command():
    init_db()
    print("Initialized the database.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
