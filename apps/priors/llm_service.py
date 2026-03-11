import os
import re

import google.generativeai as genai


def get_likelihood_of_yes(question: str) -> float:
    """
    Ask Gemini for a calibrated 0-100 probability that the answer to the
    question is "yes", then normalise to 0.0-1.0.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return 0.5

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = (
        "You are a calibrated forecasting assistant.\n"
        "Given a yes/no question, respond with ONLY a single integer from 0 to 100 "
        "representing the probability (as a percentage) that the answer is yes.\n"
        "Do not include any explanation, punctuation, or other text — just the number.\n\n"
        f"Question: {question}"
    )

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "max_output_tokens": 8,
                "temperature": 0.2,
                "candidate_count": 1,
            },
        )
        text = response.text.strip()
        match = re.search(r"\d+", text)
        if match:
            pct = int(match.group())
            pct = max(0, min(100, pct))
            return pct / 100.0
    except Exception as exc:
        print(f"LLM error: {exc}")

    return 0.5
