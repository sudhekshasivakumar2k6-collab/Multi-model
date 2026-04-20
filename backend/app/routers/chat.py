import asyncio
import logging

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import ChatRequest, ChatResponse
from app.services import bedrock, polly

router = APIRouter(prefix="/api/chat", tags=["Chat"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    messages = [m.model_dump() for m in request.messages]

    # Extract the last user text for image-trigger detection
    last_user_content = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )
    if isinstance(last_user_content, list):
        last_user_text = " ".join(b["text"] for b in last_user_content if "text" in b)
    else:
        last_user_text = last_user_content or ""

    # ── 1. Invoke LLM (run in thread so we don't block the event loop) ────────
    try:
        response_text, tokens, model_id_used = await asyncio.to_thread(
            bedrock.invoke_chat, messages
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    # ── 2. Image + TTS — run concurrently if both needed ─────────────────────
    async def _maybe_image() -> str | None:
        if not bedrock.is_image_request(last_user_text):
            return None
        try:
            return await asyncio.to_thread(bedrock.generate_image, last_user_text)
        except RuntimeError as exc:
            logger.error("Image generation skipped: %s", exc)
            return None

    async def _maybe_audio() -> str | None:
        if not request.voice_response:
            return None
        try:
            return await asyncio.to_thread(polly.synthesize_speech, response_text)
        except RuntimeError as exc:
            logger.error("TTS skipped: %s", exc)
            return None

    image_url, audio_url = await asyncio.gather(_maybe_image(), _maybe_audio())

    return ChatResponse(
        response=response_text,
        audio_url=audio_url,
        image_url=image_url,
        tokens_used=tokens,
        model_id=model_id_used,   # ← now always reflects the actual model used
    )
