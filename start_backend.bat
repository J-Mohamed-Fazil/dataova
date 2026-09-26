@echo off
title DATOVA AI - Backend Server (FastAPI)
echo ========================================================
echo   Starting DATOVA AI Backend (FastAPI on Port 8000)
echo ========================================================
cd /d "%~dp0backend"
python run.py
pause
