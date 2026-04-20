import asyncio
import logging

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import TTSRequest, TTSResponse
from app.services.polly import synthesize_speech

router = APIRouter(prefix="/api/tts", tags=["TTS"])
logger = logging.getLogger(__name__)


@router.post("", response_model=TTSResponse)
async def tts(request: TTSRequest) -> TTSResponse:
    try:
        audio_url = await asyncio.to_thread(synthesize_speech, request.text)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return TTSResponse(audio_url=audio_url)
