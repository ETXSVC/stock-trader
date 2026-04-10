# Stock Trader — Claude Instructions

## Project
Self-hosted stock price sampling bot. FastAPI backend + React/TypeScript frontend.
GitHub: https://github.com/ETXSVC/stock-trader (default branch: `master`)

## Running the servers

```bat
start.bat   # opens Backend and Frontend in separate cmd windows
stop.bat    # kills both by port (8000, 5173)
```

**uvicorn is NOT on PATH.** Full path required:
```
%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts\uvicorn.exe
```

Backend: `http://localhost:8000`
Frontend: `http://localhost:5173` (Vite proxies `/api` and `/appws` to port 8000)

## Architecture

```
backend/
  main.py              FastAPI app, lifespan, /appws WebSocket
  models.py            Stock, Sample, Alert, Notification, ScheduledJob
  database.py          SQLite + WAL mode + busy_timeout=10000 (event listener)
  sampler.py           yf.download() — 50 tickers/batch, 2s delay
  scheduler.py         APScheduler, DB-driven dynamic add/remove
  routes/schedules.py  CRUD /api/schedules

frontend/
  vite.config.ts       Proxy: /api → :8000, /appws → ws://:8000
  src/api/client.ts    BASE_URL="" (relative), all API methods typed
  src/pages/Settings.tsx  SchedulesSection, stocks, export, trigger
```

## Critical rules

- **Never pass `requests.Session` to yfinance** — raises `YFDataException`. Let yfinance handle auth internally.
- **WebSocket path is `/appws`**, not `/ws` — Vite 8 uses `/ws` for HMR.
- **SQLite WAL pragmas go in the event listener** in `database.py`, not just at engine creation.
- **Long-running operations use `BackgroundTasks`** — never block the request thread with sampling.
- **Schedules are DB-driven** — APScheduler is loaded from `scheduled_jobs` table on startup; use `sched.add_job()` / `sched.remove_job()` after every DB write.

## Stack
- Python (Windows Store 3.13), FastAPI 0.115, SQLAlchemy 2, APScheduler 3.10, yfinance ≥1.2.1, httpx
- Node 20+, React 18, TypeScript, Vite 8
- SQLite (WAL mode, single file at `data/stocks.db`)

## Tests
```bash
pytest
```
