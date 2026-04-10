@echo off
echo Stopping Stock Trader servers...

REM Kill uvicorn (backend)
taskkill /f /im uvicorn.exe > nul 2>&1

REM Kill node (frontend / Vite dev server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do (
    taskkill /f /pid %%a > nul 2>&1
)

echo Servers stopped.
