@echo off
echo Starting Stock Trader servers...

REM Start backend and capture PID
start /b cmd /c "cd /d %~dp0 && uvicorn backend.main:app --reload --port 8000 > logs\backend.log 2>&1"
timeout /t 1 /nobreak > nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do (
    set BACKEND_PID=%%a
    goto :got_backend
)
:got_backend

REM Wait for backend to initialize
timeout /t 3 /nobreak > nul

REM Start frontend and capture PID
start /b cmd /c "cd /d %~dp0frontend && npm run dev > ..\logs\frontend.log 2>&1"
timeout /t 2 /nobreak > nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do (
    set FRONTEND_PID=%%a
    goto :got_frontend
)
:got_frontend

REM Save PIDs for stop.bat
if not exist "%~dp0logs" mkdir "%~dp0logs"
echo %BACKEND_PID% > "%~dp0.pids"
echo %FRONTEND_PID% >> "%~dp0.pids"

echo.
echo Backend:  http://localhost:8000  (PID %BACKEND_PID%)
echo Frontend: http://localhost:5173  (PID %FRONTEND_PID%)
echo Logs:     logs\backend.log and logs\frontend.log
echo.
echo Run stop.bat to shut down both servers.
