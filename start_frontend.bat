@echo off
title DATOVA AI - Frontend Dev Server (Vite)
echo ========================================================
echo   Starting DATOVA AI Frontend (Vite on Port 5173)
echo ========================================================
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Users\Mohamed Fazil J\AppData\Local\OpenAI\Codex\runtimes\cua_node\23828fd353da361d\bin\node.exe" (
        set "PATH=C:\Users\Mohamed Fazil J\AppData\Local\OpenAI\Codex\runtimes\cua_node\23828fd353da361d\bin;%PATH%"
    ) else if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else if exist "%LocalAppData%\Programs\node\node.exe" (
        set "PATH=%LocalAppData%\Programs\node;%PATH%"
    )
)
cd /d "%~dp0frontend"
npm.cmd run dev
pause
