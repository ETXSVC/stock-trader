@echo off
echo Stopping Stock Trader servers...

REM Kill by saved PIDs if available
if exist "%~dp0.pids" (
    for /f %%a in (%~dp0.pids) do (
        taskkill /f /pid %%a > nul 2>&1
    )
    del "%~dp0.pids" > nul 2>&1
)

REM Fallback: kill anything still on ports 8000 and 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /f /pid %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /f /pid %%a > nul 2>&1

echo Both servers stopped.
