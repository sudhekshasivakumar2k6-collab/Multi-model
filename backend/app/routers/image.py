import asyncio
import logging

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import ImageRequest, ImageResponse
from app.services.bedrock import generate_image

router = APIRouter(prefix="/api/image", tags=["Image"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ImageResponse)
async def image_generate(request: ImageRequest) -> ImageResponse:
    try:
        image_url = await asyncio.to_thread(generate_image, request.prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return ImageResponse(image_url=image_url, prompt=request.prompt)
