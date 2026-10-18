import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from config import settings


class AIProviderError(Exception):
    """Raised when Ollama cannot return a usable response."""


def _request_completion(messages: list[dict], *, json_mode: bool = False) -> str:
    url = f"{settings.AI_BASE_URL.rstrip('/')}/chat"
    payload = {
        "model": settings.AI_MODEL,
        "messages": [
            {"role": message["role"], "content": message["content"]}
            for message in messages
            if message.get("role") in {"system", "user", "assistant"}
        ],
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 4000},
    }
    if json_mode:
        payload["format"] = "json"

    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.AI_TIMEOUT_SECONDS) as response:
            response_body = response.read(200_001)
        if len(response_body) > 200_000:
            raise AIProviderError(
                "Ollama returned an oversized response. Please try again."
            )
        provider_response = json.loads(response_body.decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            message = (
                f"Ollama model '{settings.AI_MODEL}' was not found. "
                f"Pull it with 'ollama pull {settings.AI_MODEL}' and retry."
            )
        elif exc.code == 429:
            message = "Ollama is busy. Wait a moment and try again."
        elif exc.code >= 500:
            message = (
                "Ollama could not generate a response. Check that the Ollama "
                "service is running and the selected model is available."
            )
        else:
            message = (
                "Ollama rejected the request. Check AI_BASE_URL and AI_MODEL "
                "in backend/.env."
            )
        raise AIProviderError(message) from exc
    except (URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
        raise AIProviderError(
            "Could not connect to Ollama. Ensure it is running and AI_BASE_URL "
            "in backend/.env points to its API."
        ) from exc

    if not isinstance(provider_response, dict):
        raise AIProviderError(
            "Ollama returned an invalid response. Please try again."
        )
    if provider_response.get("error"):
        raise AIProviderError(
            "Ollama could not generate a response. Check that the selected "
            "model is available and try again."
        )
    message = provider_response.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise AIProviderError("Ollama returned an empty response. Please try again.")
    return content.strip()


async def complete(messages: list[dict], *, json_mode: bool = False) -> str:
    return await asyncio.to_thread(
        _request_completion,
        messages,
        json_mode=json_mode,
    )


def parse_json_response(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        result = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIProviderError(
            "Ollama returned content in an unexpected format. Please try again."
        ) from exc
    if not isinstance(result, dict):
        raise AIProviderError(
            "Ollama returned content in an unexpected format. Please try again."
        )
    return result
