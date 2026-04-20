"""
Diagnostic test script for the Multi-Modal Assistant backend.
Tests AWS connectivity: Bedrock (chat + model listing), Polly, Transcribe, S3.

Usage (from the backend/ directory):
    .venv\\Scripts\\python.exe test_models.py
    # OR
    python test_models.py  (with .venv activated)
"""
import json
import sys
import os

# ── Force UTF-8 on Windows terminals ─────────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import boto3
from botocore.exceptions import ClientError, BotoCoreError

# Load settings from .env
from app.config import get_settings

s = get_settings()

SEP  = "═" * 64
SEP2 = "─" * 64

def ok(msg):   print(f"  ✅ {msg}")
def fail(msg): print(f"  ❌ {msg}")
def warn(msg): print(f"  ⚠  {msg}")
def info(msg): print(f"     {msg}")

# ── AWS client factory ────────────────────────────────────────────────────────
def _client(service: str):
    kwargs = {"region_name": s.aws_region}
    if s.aws_access_key_id:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.client(service, **kwargs)

print(f"\n{SEP}")
print(f"  Multi-Modal Assistant — AWS Diagnostic  |  region: {s.aws_region}")
print(f"{SEP}\n")

print(f"  Config snapshot:")
info(f"chat_model     = {s.bedrock_chat_model_id}")
info(f"image_model    = {s.bedrock_image_model_id}")
info(f"max_tokens     = {s.bedrock_max_tokens}")
info(f"temperature    = {s.bedrock_temperature}  top_p={s.bedrock_top_p}")
info(f"polly_voice    = {s.polly_voice_id}  engine={s.polly_engine}")
info(f"s3_bucket      = {s.s3_bucket_name}")
info(f"transcribe_lang= {s.transcribe_language_code}")
print()

all_ok = True

# ══════════════════════════════════════════════════════════════════════════════
# 1. Bedrock — Chat model (live Converse API test)
# ══════════════════════════════════════════════════════════════════════════════
print("1. Bedrock — Chat (Amazon Nova-Lite Converse API)")
print(SEP2)

CHAT_MODELS = list({s.bedrock_chat_model_id, "amazon.nova-micro-v1:0"})
bedrock_rt = _client("bedrock-runtime")

for model_id in sorted(CHAT_MODELS):
    try:
        resp = bedrock_rt.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": "Reply with exactly: OK"}]}],
            inferenceConfig={"maxTokens": 16, "temperature": 0.0},
        )
        reply  = resp["output"]["message"]["content"][0]["text"].strip()[:60]
        tokens = resp["usage"]["inputTokens"] + resp["usage"]["outputTokens"]
        ok(f"{model_id}")
        info(f"reply='{reply}'  tokens={tokens}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg  = e.response["Error"]["Message"]
        fail(f"{model_id}  [{code}]")
        info(msg)
        if code == "AccessDeniedException":
            info("Hint: enable this model in AWS Console → Bedrock → Model access")
        all_ok = False
    except BotoCoreError as e:
        fail(f"{model_id}  BotoCoreError: {e}")
        all_ok = False
    print()

# ══════════════════════════════════════════════════════════════════════════════
# 2. Bedrock — Image model catalog check
# ══════════════════════════════════════════════════════════════════════════════
print("2. Bedrock — Image model catalog")
print(SEP2)
info(f"Configured: {s.bedrock_image_model_id}")
info("Note: v2 uses Pollinations.ai for image generation (no Bedrock image call)")

bedrock_mgmt = _client("bedrock")
try:
    resp     = bedrock_mgmt.list_foundation_models(byOutputModality="IMAGE")
    ids      = {m["modelId"] for m in resp.get("modelSummaries", [])}
    base_id  = s.bedrock_image_model_id.rsplit(":", 1)[0]
    if s.bedrock_image_model_id in ids or base_id in ids:
        ok(f"'{s.bedrock_image_model_id}' found in your region's model catalog")
    else:
        warn(f"'{s.bedrock_image_model_id}' NOT found in catalog for region {s.aws_region}")
        info(f"Available image models: {sorted(ids)[:5]} ...")
except ClientError as e:
    fail(f"list_foundation_models: {e.response['Error']['Code']}: {e.response['Error']['Message']}")
    all_ok = False
print()

# ══════════════════════════════════════════════════════════════════════════════
# 3. Amazon Polly — synthesize a short phrase
# ══════════════════════════════════════════════════════════════════════════════
print("3. Amazon Polly — TTS synthesis")
print(SEP2)
polly = _client("polly")
try:
    resp = polly.synthesize_speech(
        Text="Test.",
        VoiceId=s.polly_voice_id,
        Engine=s.polly_engine,
        OutputFormat=s.polly_output_format,
        TextType="text",
    )
    audio = resp["AudioStream"].read()
    ok(f"Synthesized {len(audio):,} bytes  voice={s.polly_voice_id}  engine={s.polly_engine}")
except ClientError as e:
    code = e.response["Error"]["Code"]
    msg  = e.response["Error"]["Message"]
    fail(f"Polly [{code}]: {msg}")
    if code == "InvalidSampleRateException":
        info(f"Hint: voice '{s.polly_voice_id}' may not support engine '{s.polly_engine}'")
    all_ok = False
except BotoCoreError as e:
    fail(f"Polly BotoCoreError: {e}")
    all_ok = False
print()

# ══════════════════════════════════════════════════════════════════════════════
# 4. Amazon S3 — bucket access check
# ══════════════════════════════════════════════════════════════════════════════
print("4. Amazon S3 — bucket access")
print(SEP2)
s3 = _client("s3")

# Head bucket (checks existence and access)
try:
    s3.head_bucket(Bucket=s.s3_bucket_name)
    ok(f"Bucket '{s.s3_bucket_name}' exists and is accessible")
except ClientError as e:
    code = e.response["Error"]["Code"]
    if code == "404":
        fail(f"Bucket '{s.s3_bucket_name}' does NOT exist — create it first")
        info("Run: aws s3 mb s3://" + s.s3_bucket_name + " --region " + s.aws_region)
    elif code == "403":
        fail(f"Access denied to bucket '{s.s3_bucket_name}' — check IAM permissions")
    else:
        fail(f"S3 head_bucket [{code}]: {e.response['Error']['Message']}")
    all_ok = False
except BotoCoreError as e:
    fail(f"S3 BotoCoreError: {e}")
    all_ok = False

# Round-trip: put + presign + delete a tiny object
if all_ok:
    test_key = "ci-test/diagnostic-probe.txt"
    try:
        s3.put_object(Bucket=s.s3_bucket_name, Key=test_key, Body=b"mma-v2-test", ContentType="text/plain")
        url = s3.generate_presigned_url("get_object", Params={"Bucket": s.s3_bucket_name, "Key": test_key}, ExpiresIn=60)
        s3.delete_object(Bucket=s.s3_bucket_name, Key=test_key)
        ok("PutObject + presign URL + DeleteObject all succeeded")
        info(f"Sample URL prefix: {url[:80]}...")
    except ClientError as e:
        fail(f"S3 round-trip [{e.response['Error']['Code']}]: {e.response['Error']['Message']}")
        all_ok = False
print()

# ══════════════════════════════════════════════════════════════════════════════
# 5. Amazon Transcribe — IAM permission check (dry run, no audio upload)
# ══════════════════════════════════════════════════════════════════════════════
print("5. Amazon Transcribe — permission check")
print(SEP2)
transcribe = _client("transcribe")
try:
    # Listing jobs is a read-only permission check that costs nothing
    transcribe.list_transcription_jobs(MaxResults=1)
    ok("ListTranscriptionJobs — Transcribe access confirmed")
except ClientError as e:
    code = e.response["Error"]["Code"]
    fail(f"Transcribe [{code}]: {e.response['Error']['Message']}")
    if code == "AccessDeniedException":
        info("Add 'transcribe:ListTranscriptionJobs' to your IAM policy")
    all_ok = False
except BotoCoreError as e:
    fail(f"Transcribe BotoCoreError: {e}")
    all_ok = False
print()

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
print(SEP)
if all_ok:
    print("  ✅  All checks passed — backend is ready to run!")
else:
    print("  ❌  Some checks failed — fix the issues above before starting the app.")
print(f"{SEP}\n")
