@echo off
setlocal enabledelayedexpansion
title LOG-SENTINEL LAUNCHER

:: ============================================================
::  LOG-SENTINEL — One-click launcher
::  Double-click this file to start everything.
::  Backend  -> http://localhost:8000
::  Frontend -> http://localhost:3000
:: ============================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo.
echo  =====================================================
echo    L O G - S E N T I N E L   ^|  AI Threat Detection
echo  =====================================================
echo.
echo  [1/4]  Checking Python ...
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Install Python 3.10+ and add to PATH.
    pause
    exit /b 1
)
echo         OK

echo  [2/4]  Checking Node.js ...
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install Node.js 18+ and add to PATH.
    pause
    exit /b 1
)
echo         OK

echo  [3/4]  Checking demo log ...
if not exist "%ROOT%demo\sample.log" (
    echo         Generating demo log ^(first run only, ~5 sec^) ...
    python "%BACKEND%\demo_data.py"
    if errorlevel 1 (
        echo  [WARN]  Demo log generation failed. You can still upload your own log.
    ) else (
        echo         Generated successfully.
    )
) else (
    echo         Found: demo\sample.log
)

echo  [4/4]  Launching services ...
echo.

:: ---- Kill anything already on these ports cleanly ----
echo  Freeing port 8000 ^(backend^) ...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 "') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo  Freeing port 3000 ^(frontend^) ...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000 "') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: ---- Start FastAPI Backend ----
echo.
echo  Starting FastAPI backend  (http://localhost:8000) ...
start "LOG-SENTINEL BACKEND" cmd /k "cd /d "%BACKEND%" && echo Backend starting... && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: ---- Wait for backend to be ready (up to 30s) ----
echo  Waiting for backend to be ready ...
set /a TRIES=0
:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a TRIES+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health 2>nul | findstr "200" >nul
if not errorlevel 1 (
    echo  Backend is UP after !TRIES!s
    goto BACKEND_READY
)
if !TRIES! geq 30 (
    echo  [WARN]  Backend didn't respond in 30s. Launching frontend anyway.
    goto BACKEND_READY
)
goto WAIT_LOOP

:BACKEND_READY

:: ---- Start Next.js Frontend ----
echo.
echo  Starting Next.js frontend (http://localhost:3000) ...
start "LOG-SENTINEL FRONTEND" cmd /k "cd /d "%FRONTEND%" && echo Frontend starting... && npm run dev"

:: ---- Wait a moment then open browser ----
echo  Waiting for frontend to compile ...
timeout /t 6 /nobreak >nul

echo.
echo  Opening browser ...
start "" "http://localhost:3000"

echo.
echo  =====================================================
echo    ALL SYSTEMS GO
echo    Backend  : http://localhost:8000
echo    Frontend : http://localhost:3000
echo    Docs     : http://localhost:8000/docs
echo  =====================================================
echo.
echo  Both services are running in their own windows.
echo  Close those windows to stop the servers.
echo  Press any key to close this launcher window.
echo.
pause >nul
