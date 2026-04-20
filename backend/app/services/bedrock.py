import base64
import logging
from functools import lru_cache

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import get_settings
from app.services.s3 import upload_and_get_url

logger = logging.getLogger(__name__)

# ── Image trigger keywords ─────────────────────────────────────────────────────
# These words/phrases in the user message trigger automatic image generation
# via Pollinations.ai (free, no AWS cost). Nova Canvas is the configured ID
# in settings and would be used if swapped in — current impl uses Pollinations.
IMAGE_TRIGGER_KEYWORDS = [
    # generate …
    "generate image", "generate a image", "generate an image",
    "generate picture", "generate a picture",
    # create …
    "create image", "create a image", "create an image",
    "create picture", "create a picture", "create a photo", "create a photograph",
    # draw / paint / sketch / render / illustrate
    "draw", "paint a", "paint an", "sketch a", "sketch an",
    "illustrate", "render a", "render an",
    # show / make / produce
    "show image", "show me a picture", "show me an image",
    "make image", "make a image", "make an image", "make a picture",
    "produce an image", "produce a picture",
    # misc
    "visualize", "design a", "design an",
]


def is_image_request(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in IMAGE_TRIGGER_KEYWORDS)


@lru_cache(maxsize=1)
def _bedrock_client():
    """Cached Bedrock runtime client — created once per process."""
    s = get_settings()
    kwargs: dict = {"region_name": s.aws_region}
    if s.aws_access_key_id:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.client("bedrock-runtime", **kwargs)


def invoke_chat(messages: list[dict], system_prompt: str | None = None) -> tuple[str, int, str]:
    """
    Invoke the Bedrock Converse API.

    Returns:
        (response_text, total_tokens, model_id_used)
    """
    s = get_settings()
    formatted: list[dict] = []

    for m in messages:
        content_val = m["content"]
        if isinstance(content_val, str):
            content_val = [{"text": content_val}]
        elif isinstance(content_val, list):
            sanitized = []
            for block in content_val:
                # Decode base64 image bytes if still a string
                img = block.get("image")
                if img and "source" in img and "bytes" in img["source"]:
                    raw = img["source"]["bytes"]
                    if isinstance(raw, str):
                        block = {
                            **block,
                            "image": {
                                **img,
                                "source": {**img["source"], "bytes": base64.b64decode(raw)},
                            },
                        }
                sanitized.append(block)
            content_val = sanitized
        formatted.append({"role": m["role"], "content": content_val})

    model_id = s.bedrock_chat_model_id
    logger.info("Chat → model=%s messages=%d", model_id, len(formatted))

    try:
        response = _bedrock_client().converse(
            modelId=model_id,
            messages=formatted,
            system=[{"text": system_prompt or s.app_system_prompt}],
            inferenceConfig={
                "maxTokens": s.bedrock_max_tokens,
                "temperature": s.bedrock_temperature,
                "topP": s.bedrock_top_p,
            },
        )
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        msg = exc.response["Error"]["Message"]
        logger.error("Bedrock ClientError [%s]: %s (model=%s)", code, msg, model_id)
        raise RuntimeError(f"Bedrock chat failed [{code}]: {msg}") from exc
    except BotoCoreError as exc:
        logger.error("Bedrock BotoCoreError: %s", exc)
        raise RuntimeError(f"Bedrock chat failed: {exc}") from exc

    text = response["output"]["message"]["content"][0]["text"].strip()
    tokens = response["usage"]["inputTokens"] + response["usage"]["outputTokens"]
    logger.info("Chat OK: model=%s tokens=%d", model_id, tokens)
    return text, tokens, model_id


def generate_image(prompt: str) -> str:
    """
    Generate an image using Pollinations.ai (free, no AWS cost) and store in S3.

    NOTE: The configured `bedrock_image_model_id` (Nova Canvas) is reserved for
    future swap-in. Current implementation routes through Pollinations.ai to avoid
    Nova Canvas per-image cost during development.
    """
    import urllib.parse
    import urllib.request

    enhanced = f"{prompt}, high quality, detailed, digital art, 4k"
    url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(enhanced)

    logger.info("Image request (Pollinations.ai): '%.80s'", prompt)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=25) as resp:
            image_bytes = resp.read()
    except Exception as exc:
        logger.error("Image generation failed: %s", exc)
        raise RuntimeError(f"Image generation failed: {exc}") from exc

    if not image_bytes:
        raise RuntimeError("Image API returned empty response.")

    logger.info("Image OK: %d bytes, uploading to S3", len(image_bytes))
    return upload_and_get_url(image_bytes, content_type="image/jpeg", prefix="images", extension="jpg")
