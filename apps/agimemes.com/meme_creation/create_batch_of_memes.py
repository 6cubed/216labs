import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import requests

from meme_creation.meme_variants_config import DEFAULT_MEME_VARIANTS

IMGFLIP_CAPTION_URL = "https://api.imgflip.com/caption_image"
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "for",
    "from",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "over",
    "the",
    "to",
    "with",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        delete=False,
    ) as temp_file:
        json.dump(payload, temp_file, indent=2)
        temp_file.write("\n")
        temp_name = temp_file.name
    os.replace(temp_name, path)


def load_generated_memes(data_file: Path) -> Dict[str, Any]:
    if not data_file.exists():
        return {
            "memes": [],
            "meta": {
                "last_run_at": None,
                "last_status": "never_ran",
                "last_message": "No generation run has completed yet.",
                "last_generated_count": 0,
            },
        }
    with data_file.open("r", encoding="utf-8") as file_handle:
        data = json.load(file_handle)
    if "memes" not in data:
        data["memes"] = []
    if "meta" not in data:
        data["meta"] = {}
    return data


def save_generated_memes(data_file: Path, data: Dict[str, Any]) -> None:
    _atomic_write_json(data_file, data)


def _headline_keywords(headline: str) -> List[str]:
    words = re.findall(r"[A-Za-z0-9']+", headline)
    cleaned = [word for word in words if word.lower() not in STOPWORDS]
    return cleaned[:6]


def build_caption_parts(headline: str) -> List[str]:
    keywords = _headline_keywords(headline)
    if len(keywords) >= 3:
        return [keywords[0], "My plans this week", keywords[2]]
    if len(keywords) == 2:
        return [keywords[0], "My plans this week", keywords[1]]
    if len(keywords) == 1:
        return [keywords[0], "Me trying to relax", "Breaking news"]
    return ["Me", "A peaceful day", "The news cycle"]


def fetch_top_headlines(news_api_key: str, limit: int = 5) -> List[Dict[str, str]]:
    from newsapi import NewsApiClient

    news_client = NewsApiClient(api_key=news_api_key)
    response = news_client.get_top_headlines(language="en", page_size=limit)
    articles = response.get("articles", [])
    parsed_articles = []
    for article in articles:
        title = (article or {}).get("title")
        url = (article or {}).get("url")
        if not title or not url:
            continue
        parsed_articles.append(
            {
                "headline": title.strip(),
                "article_url": url,
                "source": ((article or {}).get("source") or {}).get("name") or "Unknown",
                "published_at": (article or {}).get("publishedAt") or "",
            }
        )
    return parsed_articles[:limit]


def caption_meme(
    template_id: int,
    username: str,
    password: str,
    captions: List[str],
) -> Tuple[Optional[str], Optional[str]]:
    payload = {
        "template_id": str(template_id),
        "username": username,
        "password": password,
    }
    for index, caption in enumerate(captions):
        payload[f"boxes[{index}][text]"] = caption

    response = requests.post(IMGFLIP_CAPTION_URL, data=payload, timeout=20)
    response.raise_for_status()
    result = response.json()
    if not result.get("success"):
        return None, result.get("error_message", "Unknown Imgflip error")
    return result["data"]["url"], None


def _build_record(
    article: Dict[str, str],
    template: Dict[str, Any],
    caption_parts: List[str],
    image_url: str,
) -> Dict[str, Any]:
    return {
        "id": str(uuid4()),
        "headline": article["headline"],
        "article_url": article["article_url"],
        "source": article["source"],
        "template_id": template["id"],
        "template_name": template["title"],
        "caption_parts": caption_parts,
        "image_url": image_url,
        "created_at": _now_iso(),
    }


def create_daily_meme_batch(
    data_file: Path,
    limit: int = 5,
    news_api_key: Optional[str] = None,
    imgflip_username: Optional[str] = None,
    imgflip_password: Optional[str] = None,
) -> Dict[str, Any]:
    data = load_generated_memes(data_file)
    now = _now_iso()

    if not news_api_key:
        data["meta"] = {
            "last_run_at": now,
            "last_status": "skipped",
            "last_message": "NEWS_API_KEY is missing.",
            "last_generated_count": 0,
        }
        save_generated_memes(data_file, data)
        return data["meta"]

    if not imgflip_username or not imgflip_password:
        data["meta"] = {
            "last_run_at": now,
            "last_status": "skipped",
            "last_message": "IMG_FLIP_USERNAME or IMG_FLIP_PASSWORD is missing.",
            "last_generated_count": 0,
        }
        save_generated_memes(data_file, data)
        return data["meta"]

    try:
        articles = fetch_top_headlines(news_api_key=news_api_key, limit=limit)
    except Exception as error:  # pragma: no cover
        data["meta"] = {
            "last_run_at": now,
            "last_status": "error",
            "last_message": f"Failed to fetch headlines: {error}",
            "last_generated_count": 0,
        }
        save_generated_memes(data_file, data)
        return data["meta"]

    generated: List[Dict[str, Any]] = []
    for index, article in enumerate(articles):
        template = DEFAULT_MEME_VARIANTS[index % len(DEFAULT_MEME_VARIANTS)]
        caption_parts = build_caption_parts(article["headline"])
        try:
            image_url, _ = caption_meme(
                template_id=template["id"],
                username=imgflip_username,
                password=imgflip_password,
                captions=caption_parts,
            )
        except Exception:  # pragma: no cover
            image_url = None
        if not image_url:
            continue
        generated.append(_build_record(article, template, caption_parts, image_url))

    memes = generated + data.get("memes", [])
    data["memes"] = memes[:100]
    data["meta"] = {
        "last_run_at": now,
        "last_status": "ok" if generated else "partial",
        "last_message": (
            f"Generated {len(generated)} memes."
            if generated
            else "No memes were generated. Check credentials or provider limits."
        ),
        "last_generated_count": len(generated),
    }
    save_generated_memes(data_file, data)
    return data["meta"]
