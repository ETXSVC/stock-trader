@echo off
echo Starting Stock Trader servers...

REM Create logs directory first
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM Start backend in a new window
start "Backend" cmd /k "cd /d %~dp0 && uvicorn backend.main:app --reload --port 8000"

REM Wait for backend to initialize before starting frontend
timeout /t 4 /nobreak > nul

REM Start frontend in a new window
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close the server windows or run stop.bat to shut down.
