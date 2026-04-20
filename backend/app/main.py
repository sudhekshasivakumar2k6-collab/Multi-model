import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.models.schemas import HealthResponse
from app.routers import chat, image, transcribe, tts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

_VERSION = "2.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    logger.info(
        "Starting v%s | region=%s | chat=%s | image=%s | bucket=%s",
        _VERSION, s.aws_region, s.bedrock_chat_model_id,
        s.bedrock_image_model_id, s.s3_bucket_name,
    )
    logger.info("CORS Origins: %s", s.app_cors_origins)
    yield
    logger.info("Shutting down.")


def create_app() -> FastAPI:
    s = get_settings()

    app = FastAPI(
        title="Multi-Modal Assistant API",
        description="AI assistant powered by Amazon Bedrock (Nova-Lite), Transcribe, Polly, and S3.",
        version=_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.app_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled: %s %s → %s", request.method, request.url, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error.", "code": "INTERNAL_ERROR"},
        )

    @app.get("/health", response_model=HealthResponse, tags=["Health"])
    async def health():
        s = get_settings()
        return HealthResponse(
            status="ok",
            region=s.aws_region,
            chat_model=s.bedrock_chat_model_id,
            image_model=s.bedrock_image_model_id,
            version=_VERSION,
        )

    app.include_router(chat.router)
    app.include_router(transcribe.router)
    app.include_router(image.router)
    app.include_router(tts.router)

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
