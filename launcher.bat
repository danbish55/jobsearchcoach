@echo off
title JobSearchCoach — Career Coaching
color 0A
cls
echo.
echo   ================================================
echo    JOBSEARCHCOACH  v1.0 — Powered by Claude AI
echo   ================================================
echo.
echo   Starting your coaching session...
echo   Your browser will open in a moment.
echo.
echo   To stop the app: close this window or Ctrl+C
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Python not found.
    echo   Please install Python 3.8+ from https://www.python.org/downloads/
    echo   Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

cd /d "%~dp0"
python server.py

if %errorlevel% neq 0 (
    echo.
    echo   Something went wrong. Press any key to exit.
    pause >nul
)
