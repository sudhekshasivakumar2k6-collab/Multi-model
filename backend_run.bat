@echo off
title Multi-Modal Assistant — Backend
echo ================================================
echo  Starting FastAPI Backend on http://localhost:8000
echo ================================================
cd /d "d:\project\multi-modal-assistant\backend"
call .venv\Scripts\activate.bat
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env
pause
