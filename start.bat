@echo off
echo Starting Stock Trader servers...

REM Start backend
start "Stock Trader - Backend" cmd /k "cd /d %~dp0 && uvicorn backend.main:app --reload --port 8000"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

REM Start frontend
start "Stock Trader - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close this window or run stop.bat to shut down servers.
