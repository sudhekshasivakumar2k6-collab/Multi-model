import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _s3_client():
    """Cached S3 client — created once per process."""
    s = get_settings()
    kwargs: dict = {"region_name": s.aws_region}
    if s.aws_access_key_id:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.client("s3", **kwargs)


def upload_bytes(
    data: bytes,
    content_type: str,
    prefix: str = "uploads",
    extension: str = "bin",
) -> str:
    s = get_settings()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    key = f"{prefix}/{ts}-{uuid.uuid4().hex[:8]}.{extension}"
    try:
        _s3_client().put_object(
            Bucket=s.s3_bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info("S3 upload: %d bytes → s3://%s/%s", len(data), s.s3_bucket_name, key)
        return key
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"S3 upload failed: {exc}") from exc


def generate_presigned_url(key: str, expires_in: int | None = None) -> str:
    s = get_settings()
    try:
        return _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": s.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in or s.s3_presigned_url_expiry,
        )
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Presigned URL failed: {exc}") from exc


def upload_and_get_url(
    data: bytes,
    content_type: str,
    prefix: str = "uploads",
    extension: str = "bin",
) -> str:
    return generate_presigned_url(
        upload_bytes(data, content_type, prefix=prefix, extension=extension)
    )
