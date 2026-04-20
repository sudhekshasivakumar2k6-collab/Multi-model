from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str | list[dict]


class ChatRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    messages: list[Message] = Field(..., min_length=1)
    voice_response: bool = False
    model_id: str | None = None  # Optional model override, reflected in response


class ChatResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    response: str
    audio_url: str | None = None
    image_url: str | None = None
    tokens_used: int | None = None
    model_id: str | None = None  # Which model was actually used


class TranscribeResponse(BaseModel):
    transcript: str


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000)


class ImageResponse(BaseModel):
    image_url: str
    prompt: str


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=3000)


class TTSResponse(BaseModel):
    audio_url: str


class HealthResponse(BaseModel):
    status: str
    region: str
    chat_model: str
    image_model: str
    version: str
