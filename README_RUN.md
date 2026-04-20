# Multi-Modal Assistant — Quick Start

## Prerequisites
- Python 3.12 + `.venv` set up in `backend/`
- Node.js 20+
- AWS credentials in `backend/.env`

---

## Option 1 — One-command (both servers together)
```powershell
# From the project root:
npm run dev
```

## Option 2 — Separate terminals (recommended for dev)
```powershell
# Terminal 1 — Backend
.\backend_run.bat

# Terminal 2 — Frontend
.\frontend_run.bat
```

## Option 3 — Manual commands
```powershell
# Backend (from backend/ dir with .venv active)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env

# Frontend (from frontend/ dir)
npm run dev
```

## Option 4 — Docker Compose
```powershell
docker-compose up --build
```

---

## URLs
| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |
| Health   | http://localhost:8000/health |

---

## Run Diagnostics (verify AWS is working)
```powershell
cd backend
.venv\Scripts\python.exe test_models.py
```
