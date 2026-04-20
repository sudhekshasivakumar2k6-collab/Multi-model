# 🤖 Multi-Modal Agentic Assistant — v2

A **production-ready** AI assistant powered by **Amazon Nova-Lite** (vision + chat), **Pollinations.ai** (image generation), **Amazon Polly** (neural TTS), **Amazon Transcribe** (speech-to-text), and native **Web Speech API**. Built with **FastAPI (Python 3.12)** + **React + Vite**.

The assistant operates as an **elite, agentic pair-programmer**: analytical, structured, production-focused — with full markdown rendering in the UI.

---

## 🏗 Architecture

```
Browser (React + Vite)
    │
    ├── POST /api/chat       → Bedrock Amazon Nova-Lite (multimodal LLM)
    │                           ↳ Pollinations.ai  (image generation, async)
    │                           ↳ Amazon Polly     (TTS, async / concurrent)
    │
    ├── Web Speech API       → Local browser transcription (zero-latency)
    ├── POST /api/transcribe → Amazon Transcribe → S3
    ├── POST /api/image      → Pollinations.ai   → S3 → presigned URL
    ├── POST /api/tts        → Amazon Polly      → S3 → presigned URL
    └── GET  /health         → Live model config & version

FastAPI Backend (Python 3.12, async)
    ├── All blocking AWS calls wrapped in asyncio.to_thread
    ├── Image + TTS run concurrently via asyncio.gather
    └── boto3 clients cached via lru_cache (one per process)
```

---

## 📁 Project Structure

```
multi-modal-assistant/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, CORS, /health
│   │   ├── config.py             # Pydantic settings — all config via .env
│   │   ├── models/schemas.py     # Request / response Pydantic models
│   │   ├── routers/
│   │   │   ├── chat.py           # POST /api/chat  (async, concurrent)
│   │   │   ├── image.py          # POST /api/image
│   │   │   ├── transcribe.py     # POST /api/transcribe
│   │   │   └── tts.py            # POST /api/tts
│   │   └── services/
│   │       ├── bedrock.py        # Nova-Lite LLM + image trigger detection
│   │       ├── s3.py             # Upload + presigned URLs (cached client)
│   │       ├── polly.py          # Amazon Polly TTS (cached client)
│   │       └── transcribe.py     # Amazon Transcribe STT (cached client)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/assistant.js      # Axios client with retry + AbortSignal
│   │   ├── hooks/useAssistant.js # All state: chat, sessions, voice, files
│   │   ├── components/
│   │   │   ├── App.jsx           # Root layout, header, input bar
│   │   │   ├── ChatWindow.jsx    # Message list, smart scroll, empty state
│   │   │   ├── MessageBubble.jsx # Markdown rendering, copy btn, token badge
│   │   │   ├── ChatHistory.jsx   # Sidebar with session management
│   │   │   ├── VoiceInput.jsx    # Mic button (Web Speech API)
│   │   │   ├── AudioPlayer.jsx   # Play/pause + progress bar
│   │   │   └── ImageDisplay.jsx  # Skeleton loader → generated image
│   │   ├── App.jsx
│   │   └── index.css             # Glassmorphism design system
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
├── infra/
│   └── iam_policy.json           # Least-privilege IAM policy
├── .devcontainer/                # GitHub Codespaces config
├── .github/workflows/ci.yml      # CI: lint + import verify + build
├── package.json                  # Root dev scripts (concurrently)
└── README.md
```

---

## ✅ Prerequisites

- Python **3.12+**
- Node.js **20+**
- AWS account with programmatic access
- AWS CLI configured (`aws configure`)

---

## ☁️ AWS Setup

### 1. Create S3 Bucket

```bash
aws s3 mb s3://multi-modal-assistant-bucket --region us-east-1

# Block all public access (assets served via short-lived presigned URLs only)
aws s3api put-public-access-block \
  --bucket multi-modal-assistant-bucket \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 2. Enable Bedrock Model Access

1. Open **AWS Console → Amazon Bedrock → Model access**
2. Enable: **`Amazon Nova Lite`** (used for chat + vision)

### 3. Create IAM User / Role

```bash
# Create policy from included file
aws iam create-policy \
  --policy-name MultiModalAssistantPolicy \
  --policy-document file://infra/iam_policy.json

aws iam create-user --user-name mma-app-user
aws iam attach-user-policy \
  --user-name mma-app-user \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/MultiModalAssistantPolicy

aws iam create-access-key --user-name mma-app-user
```

> **Tip:** On EC2/ECS/Lambda — use an **IAM role** instead. Leave `AWS_ACCESS_KEY_ID` blank in `.env`; boto3 uses the instance profile automatically.

---

## 🔧 Local Development

### Quick Start (Recommended)

```bash
# 1. Clone and enter root directory
git clone <your-repo> multi-modal-assistant
cd multi-modal-assistant

# 2. Configure backend
copy backend\.env.example backend\.env   # Windows
# cp backend/.env.example backend/.env  # macOS/Linux
# → Edit backend/.env with your AWS credentials

# 3. Create Python virtual environment
python -m venv backend\.venv
backend\.venv\Scripts\activate            # Windows
# source backend/.venv/bin/activate      # macOS/Linux
pip install -r backend\requirements.txt

# 4. Install Node dependencies and start both servers
npm run setup   # installs frontend node_modules
npm run dev     # starts backend (8000) + frontend (5173) together
```

| Server | URL |
|---|---|
| **React frontend** | http://localhost:5173 |
| **FastAPI backend** | http://localhost:8000 |
| **API docs (Swagger)** | http://localhost:8000/docs |
| **Health check** | http://localhost:8000/health |

### Manual Start

```bash
# Backend
cd backend
.venv\Scripts\activate          # Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

---

## 🎯 Features

| Feature | Details |
|---|---|
| **Multimodal Chat** | Amazon Nova-Lite via Bedrock Converse API — text + image vision in one model |
| **Markdown Rendering** | AI responses render with code blocks, inline code, bold, lists, headers |
| **Agentic Persona** | Elite pair-programmer system prompt: structured, analytical, production-focused |
| **Voice Input** | Native Web Speech API — zero-latency local browser transcription, auto-sends |
| **Image Generation** | Keyword detection → Pollinations.ai → S3 presigned URL |
| **Voice Response** | Amazon Polly neural TTS → MP3 → S3 presigned URL |
| **Image Upload** | Attach JPEG/PNG/WebP — Nova-Lite analyzes inline |
| **Chat History** | Sessions auto-saved to `localStorage` — restore, rename, delete |
| **Stop Generation** | Cancel in-flight requests mid-response with the stop button |
| **Request Retry** | 1 automatic retry with 800ms backoff on 5xx / network errors |
| **Backend Status** | Live green/red dot in header — health check on app load |
| **Token Count** | Subtle badge showing token usage per assistant message |
| **Smart Scroll** | Auto-scroll pauses when you scroll up to read history |
| **Premium UI** | Glassmorphism, animated gradient background, micro-animations |
| **Accessibility** | `prefers-reduced-motion` support, ARIA labels throughout |

---

## ⚙️ Configuration Reference

All settings live in `backend/.env`. These are the key knobs:

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region for all services |
| `BEDROCK_CHAT_MODEL_ID` | `amazon.nova-lite-v1:0` | LLM model ID |
| `BEDROCK_MAX_TOKENS` | `4096` | Max response length |
| `BEDROCK_TEMPERATURE` | `0.65` | Response creativity (0=deterministic, 1=creative) |
| `BEDROCK_TOP_P` | `0.92` | Nucleus sampling |
| `POLLY_VOICE_ID` | `Joanna` | TTS voice (see [Polly voices](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html)) |
| `POLLY_ENGINE` | `neural` | `neural` or `standard` |
| `S3_BUCKET_NAME` | *(required)* | S3 bucket for media storage |
| `S3_PRESIGNED_URL_EXPIRY` | `3600` | URL expiry in seconds |
| `APP_CORS_ORIGINS` | *localhost ports* | JSON array of allowed frontend origins |

---

## 🧪 Testing API Endpoints

```bash
# Health check (returns model info)
curl http://localhost:8000/health

# Chat
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Explain async/await in Python."}],"voice_response":false}'

# Image generation
curl -X POST http://localhost:8000/api/image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a futuristic Tokyo skyline at night, neon reflections in rain"}'

# Text-to-Speech
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello! I am your AI assistant."}'
```

---

## 🚀 Deployment

### Option A – EC2 (Simple)

```bash
git clone <your-repo> && cd multi-modal-assistant

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env

# Production server with 2 workers
pip install gunicorn
gunicorn app.main:app -k uvicorn.workers.UvicornWorker \
  -w 2 --bind 0.0.0.0:8000 --daemon

# Frontend – build and serve with Nginx
cd ../frontend
npm ci && npm run build
# Copy dist/ to /var/www/html
```

### Option B – Docker

```bash
cd backend
docker build -t mma-backend .
docker run -p 8000:8000 --env-file .env mma-backend

# Frontend (static – serve with Nginx / S3 / CloudFront)
cd ../frontend
npm run build   # outputs to frontend/dist/
```

### Option C – GitHub Codespaces

Click **Code → Codespaces → Create codespace on main**.  
The `.devcontainer` config auto-installs Python 3.12, Node 20, and all dependencies.  
Add your AWS credentials as **Codespaces Secrets** in repository settings.

### Option D – GitHub Pages (Frontend Only)

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main` — the CI workflow builds and uploads `frontend/dist`
3. The hosted frontend works with a locally-running backend (AWS keys stay secure)

---

## 🛠 Troubleshooting

### "Cannot reach the server" / "Network Error"
1. Is the backend running? (`npm run dev` should show both Uvicorn and Vite)
2. Is port 8000 free? (`netstat -ano | findstr 8000` on Windows)
3. Check `APP_CORS_ORIGINS` in `backend/.env` includes your frontend port

### "Backend offline" red dot in header
The app pings `/health` on load. If it's red, the FastAPI server isn't running or reachable.

### "Port 5173 is in use"
Vite automatically tries `5174`. Add it to `APP_CORS_ORIGINS` in `backend/.env`:
```
APP_CORS_ORIGINS=["http://localhost:5173","http://localhost:5174"]
```

### "No speech detected" after mic recording
- Use Chrome or Edge (Firefox has limited Speech Recognition support)
- Allow microphone permission in browser settings

### AWS Credential Errors (`UnauthorizedAccess`, `AccessDenied`)
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `backend/.env`
- Check the IAM policy covers: `bedrock:InvokeModel`, `s3:PutObject`, `s3:GetObject`, `polly:SynthesizeSpeech`, `transcribe:StartTranscriptionJob`

---

## 🔒 Security

- Presigned S3 URLs expire after **1 hour** (configurable via `S3_PRESIGNED_URL_EXPIRY`)
- S3 bucket has **all public access blocked** — no objects are publicly accessible
- Use **IAM roles** (not access keys) on hosted infrastructure
- Never commit `.env` to git (it's in `.gitignore`)
- `APP_SYSTEM_PROMPT` is server-side only — never exposed to the client

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| **LLM / Vision** | Amazon Nova-Lite via Bedrock Converse API |
| **Image Generation** | Pollinations.ai (free, no API key) |
| **Speech-to-Text** | Web Speech API (browser-native) + Amazon Transcribe |
| **Text-to-Speech** | Amazon Polly (neural engine) |
| **Storage** | Amazon S3 (presigned URLs) |
| **Backend** | FastAPI 0.111, Python 3.12, uvicorn, pydantic-settings |
| **Frontend** | React 18, Vite 5, Axios |
| **CI/CD** | GitHub Actions (lint + import verify + build + artifact) |
| **Dev Environment** | GitHub Codespaces (`.devcontainer`) |
