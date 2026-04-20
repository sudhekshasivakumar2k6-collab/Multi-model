import asyncio
import logging

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.models.schemas import TranscribeResponse
from app.services.transcribe import transcribe_audio

router = APIRouter(prefix="/api/transcribe", tags=["Transcribe"])
logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {"webm", "mp3", "wav", "flac", "mp4", "ogg", "amr"}


@router.post("", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    media_format: str = Query(default="webm"),
) -> TranscribeResponse:
    if media_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported format '{media_format}'. Supported: {sorted(SUPPORTED_FORMATS)}",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")

    try:
        transcript = await asyncio.to_thread(transcribe_audio, audio_bytes, media_format)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No speech detected in the audio.",
        )

    return TranscribeResponse(transcript=transcript)
