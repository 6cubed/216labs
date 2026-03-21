"""Avatar — LLM conversation with TTS and a lip-synced animated face."""

from __future__ import annotations

import base64
import os

import flask

app = flask.Flask(__name__)

SYSTEM_PROMPT = """You are Avatar, a warm, perceptive conversational companion shown as a friendly face on screen.
Keep replies concise and natural for speech: usually 2–4 short sentences. Sound human: vary rhythm, use contractions,
avoid bullet lists unless asked. Light warmth and curiosity are welcome; never preach or lecture."""


def _api_key() -> str:
    return (os.environ.get("AVATAR_OPENAI_API_KEY") or "").strip()


def _chat_model() -> str:
    return (os.environ.get("AVATAR_MODEL") or "gpt-4o-mini").strip()


def _tts_voice() -> str:
    v = (os.environ.get("AVATAR_TTS_VOICE") or "nova").strip().lower()
    allowed = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
    return v if v in allowed else "nova"


@app.route("/health")
def health():
    return flask.jsonify({"ok": True, "app": "avatar", "has_key": bool(_api_key())})


@app.route("/")
def index():
    return flask.render_template("index.html")


@app.post("/api/turn")
def api_turn():
    """JSON: { messages: [{role, content}, ...] } last must be user."""
    payload = flask.request.get_json(silent=True) or {}
    raw_messages = payload.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        return flask.jsonify({"error": "messages required"}), 400

    messages = []
    for m in raw_messages:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content.strip()})
    if not messages or messages[-1]["role"] != "user":
        return flask.jsonify({"error": "last message must be from user"}), 400

    api_key = _api_key()
    if not api_key:
        return flask.jsonify(
            {
                "reply": (
                    "I need an OpenAI API key on the server to think and speak. "
                    "Ask the operator to set AVATAR_OPENAI_API_KEY."
                ),
                "audio_base64": None,
                "audio_mime": None,
            }
        )

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    chat_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages[-24:]]

    try:
        completion = client.chat.completions.create(
            model=_chat_model(),
            messages=chat_messages,
            temperature=0.75,
            max_tokens=500,
        )
    except Exception as e:
        return flask.jsonify({"error": f"chat failed: {e!s}"}), 502

    reply = (completion.choices[0].message.content or "").strip()
    if not reply:
        reply = "I'm here — could you say that once more?"

    reply = reply[:4000]

    try:
        speech = client.audio.speech.create(
            model="tts-1",
            voice=_tts_voice(),
            input=reply,
            response_format="mp3",
        )
        audio_bytes = speech.read()
        b64 = base64.b64encode(audio_bytes).decode("ascii")
        return flask.jsonify(
            {
                "reply": reply,
                "audio_base64": b64,
                "audio_mime": "audio/mpeg",
            }
        )
    except Exception as e:
        return flask.jsonify(
            {
                "reply": reply,
                "audio_base64": None,
                "audio_mime": None,
                "tts_error": str(e),
            }
        )

