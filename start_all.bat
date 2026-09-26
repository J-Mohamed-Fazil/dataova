@echo off
title DATOVA AI - Fullstack Launcher
echo ========================================================
echo   Launching DATOVA AI (Backend + Frontend)
echo   Tagline: "Upload. Ask. Discover. Decide."
echo ========================================================
start "DATOVA Backend" "%~dp0start_backend.bat"
start "DATOVA Frontend" "%~dp0start_frontend.bat"
timeout /t 3 >nul
echo Opening DATOVA AI in your browser at http://localhost:5173/ ...
start http://localhost:5173/
echo All services launched!
