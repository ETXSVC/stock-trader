# Stock Trader — Stock Sampler Bot

A self-hosted stock price tracking tool that periodically samples S&P 500 (or custom) tickers from Yahoo Finance, stores historical price data, fires configurable alerts, and displays everything in a real-time dashboard.

---

## Features

- **Automatic sampling** — pull open, midday, or close prices on a configurable schedule
- **Dynamic scheduler** — add, edit, enable/disable, and delete scheduled pulls from the UI; no restart required
- **S&P 500 initialization** — load all ~500 S&P 500 tickers in one click
- **Custom tickers** — add any ticker manually
- **Alerts** — set price/change threshold alerts; notifications delivered via WebSocket in real time
- **Top movers** — see biggest gainers and losers from the latest sample
- **CSV export** — export historical samples filtered by ticker and date range
- **Dashboard** — live price table with day-change indicators, auto-refreshing via WebSocket

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Scheduling | APScheduler 3.x (AsyncIOScheduler + CronTrigger) |
| Market data | yfinance 1.2.1 (`yf.download()` batch fetching) |
| Frontend | React 18, TypeScript, Vite 8 |
| Real-time | WebSocket (`/appws`) |

---

## Project Structure

```
stock-trader/
├── backend/
│   ├── main.py              # FastAPI app, lifespan, WebSocket endpoint
│   ├── models.py            # SQLAlchemy models (Stock, Sample, Alert, Notification, ScheduledJob)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # SQLite engine with WAL mode + busy_timeout
│   ├── sampler.py           # yf.download() batch sampler, 50 tickers/request
│   ├── scheduler.py         # APScheduler setup, dynamic add/remove jobs
│   ├── alert_engine.py      # Alert evaluation after each sample
│   ├── sp500.py             # S&P 500 ticker fetcher from Wikipedia
│   ├── websocket_manager.py # WebSocket broadcast manager
│   ├── requirements.txt
│   └── routes/
│       ├── stocks.py        # GET/POST/PUT/DELETE /api/stocks
│       ├── samples.py       # GET /api/samples, POST /api/samples/trigger
│       ├── alerts.py        # CRUD /api/alerts
│       ├── notifications.py # GET/PUT /api/notifications
│       ├── schedules.py     # CRUD /api/schedules
│       └── export.py        # GET /api/export/csv
└── frontend/
    ├── src/
    │   ├── api/client.ts    # Typed fetch wrapper for all API endpoints
    │   ├── hooks/
    │   │   └── useWebSocket.ts
    │   └── pages/
    │       ├── Dashboard.tsx
    │       ├── TopMovers.tsx
    │       ├── Alerts.tsx
    │       ├── Notifications.tsx
    │       └── Settings.tsx  # Includes SchedulesSection
    └── vite.config.ts        # Proxy /api and /appws to backend port 8000
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

On first startup the database is created, default schedules are seeded, and APScheduler loads all enabled jobs.

### Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Vite runs on port 5173 and proxies all `/api` and `/appws` requests to `localhost:8000`.

### Production build

```bash
cd frontend
npm run build
```

FastAPI serves the built `frontend/dist` as static files, so only the backend process needs to run in production.

---

## Configuration

### Default schedules

Three schedules are seeded on first startup (UTC times, Eastern approximation shown):

| Label | Sample Type | UTC | ET (approx) |
|-------|-------------|-----|-------------|
| Market Open | open | 13:30 | 9:30 AM |
| Midday | mid | 16:00 | 12:00 PM |
| Market Close | close | 20:00 | 4:00 PM |

Schedules can be freely added, edited, or deleted from **Settings → Scheduled Pulls**.

### Adding custom tickers

Go to **Settings → Add Custom Ticker** and enter a ticker symbol, company name, and optional sector.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stocks` | List all tracked stocks |
| POST | `/api/stocks` | Add a custom stock |
| POST | `/api/stocks/init-sp500` | Load S&P 500 tickers from Wikipedia |
| GET | `/api/samples` | Query historical samples |
| GET | `/api/samples/latest` | Latest sample per stock |
| GET | `/api/samples/top-movers` | Top gainers or losers |
| POST | `/api/samples/trigger` | Trigger an immediate sample (async) |
| GET | `/api/schedules` | List scheduled jobs |
| POST | `/api/schedules` | Create a scheduled job |
| PUT | `/api/schedules/{id}` | Update a scheduled job |
| DELETE | `/api/schedules/{id}` | Delete a scheduled job |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |
| GET | `/api/notifications` | List notifications |
| GET | `/api/export/csv` | Export samples as CSV |
| WS | `/appws` | WebSocket for real-time events |

---

## Running Tests

```bash
pytest
```
