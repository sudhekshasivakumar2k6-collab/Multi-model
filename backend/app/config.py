import json
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── AWS ────────────────────────────────────────────────────────────────────
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # ── S3 ─────────────────────────────────────────────────────────────────────
    s3_bucket_name: str = "multi-modal-assistant-bucket"
    s3_presigned_url_expiry: int = 3600

    # ── Bedrock – Chat ──────────────────────────────────────────────────────────
    bedrock_chat_model_id: str = "amazon.nova-lite-v1:0"
    bedrock_max_tokens: int = 5000
    bedrock_temperature: float = 0.65
    bedrock_top_p: float = 0.92

    # ── Bedrock – Image ─────────────────────────────────────────────────────────
    bedrock_image_model_id: str = "amazon.nova-canvas-v1:0"

    # ── Polly ───────────────────────────────────────────────────────────────────
    polly_voice_id: str = "Joanna"
    polly_engine: str = "neural"
    polly_output_format: str = "mp3"

    # ── Transcribe ──────────────────────────────────────────────────────────────
    transcribe_language_code: str = "en-US"
    transcribe_media_format: str = "webm"
    transcribe_job_poll_interval: float = 2.0

    # ── App ─────────────────────────────────────────────────────────────────────
    app_cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://krishna-2005-debug.github.io",
    ]
    app_log_level: str = "INFO"
    app_system_prompt: str = (
        "You are an elite AI assistant and expert pair-programmer — sharp, analytical, and production-focused. "
        "Your traits:\n"
        "• You think step-by-step and reason before answering.\n"
        "• You write clean, idiomatic, production-ready code with no shortcuts.\n"
        "• You use markdown formatting: headers, bold, code blocks, bullet lists.\n"
        "• You are concise unless depth is required — never pad responses.\n"
        "• You NEVER repeat yourself or loop on prior answers.\n"
        "• You are proactive: suggest improvements, catch edge cases, flag risks.\n"
        "• When asked to generate an image, acknowledge it briefly and let the system handle rendering.\n"
        "• Respond in the user's language if they write in a non-English language."
    )

    @field_validator("app_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
