import json
import logging
import time
import uuid
from functools import lru_cache
from urllib.request import urlopen

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import get_settings
from app.services.s3 import upload_bytes, _s3_client

logger = logging.getLogger(__name__)

_MAX_POLL_SECONDS = 120


@lru_cache(maxsize=1)
def _transcribe_client():
    """Cached Transcribe client — created once per process."""
    s = get_settings()
    kwargs: dict = {"region_name": s.aws_region}
    if s.aws_access_key_id:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.client("transcribe", **kwargs)


def _delete_s3_key(key: str) -> None:
    """Best-effort delete of an S3 object (never raises)."""
    s = get_settings()
    try:
        _s3_client().delete_object(Bucket=s.s3_bucket_name, Key=key)
        logger.debug("S3 cleanup: deleted s3://%s/%s", s.s3_bucket_name, key)
    except Exception as exc:
        logger.warning("S3 cleanup failed for key=%s: %s", key, exc)


def transcribe_audio(audio_bytes: bytes, media_format: str | None = None) -> str:
    s = get_settings()
    fmt = media_format or s.transcribe_media_format
    job_name = f"mma-{uuid.uuid4().hex}"

    # Upload audio to S3 for Transcribe
    audio_key = upload_bytes(
        audio_bytes,
        content_type=f"audio/{fmt}",
        prefix="transcribe-input",
        extension=fmt,
    )
    media_uri = f"s3://{s.s3_bucket_name}/{audio_key}"

    client = _transcribe_client()
    try:
        client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": media_uri},
            MediaFormat=fmt,
            LanguageCode=s.transcribe_language_code,
        )
    except (BotoCoreError, ClientError) as exc:
        _delete_s3_key(audio_key)  # clean up on failure to start
        raise RuntimeError(f"Failed to start Transcribe job: {exc}") from exc

    logger.info("Transcribe job started: %s (format=%s)", job_name, fmt)

    # Poll for completion
    transcript_uri: str | None = None
    max_polls = int(_MAX_POLL_SECONDS / s.transcribe_job_poll_interval)
    for attempt in range(max_polls):
        try:
            result = client.get_transcription_job(TranscriptionJobName=job_name)
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError(f"Failed to poll Transcribe job: {exc}") from exc

        job_status = result["TranscriptionJob"]["TranscriptionJobStatus"]
        if job_status == "COMPLETED":
            transcript_uri = result["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            logger.info("Transcribe job completed after %d polls", attempt + 1)
            break
        if job_status == "FAILED":
            reason = result["TranscriptionJob"].get("FailureReason", "unknown")
            _delete_s3_key(audio_key)
            raise RuntimeError(f"Transcribe job failed: {reason}")

        time.sleep(s.transcribe_job_poll_interval)
    else:
        _delete_s3_key(audio_key)
        raise RuntimeError(f"Transcribe job timed out after {_MAX_POLL_SECONDS}s.")

    # Fetch transcript JSON
    with urlopen(transcript_uri) as resp:
        data = json.loads(resp.read())

    transcript = (
        data.get("results", {})
        .get("transcripts", [{}])[0]
        .get("transcript", "")
        .strip()
    )
    logger.info("Transcribed %d chars (job=%s)", len(transcript), job_name)

    # Clean up the S3 audio object — best-effort, never blocks result
    _delete_s3_key(audio_key)

    return transcript
