# Stock Trader — Stock Sampler Bot

A self-hosted stock price tracking tool that periodically samples S&P 500 (or custom) tickers from Yahoo Finance, stores historical price data, fires configurable alerts, and displays everything in a real-time dashboard.

---

## Features

- **Automatic sampling** — pull intraday prices on a configurable schedule using 1-minute interval data
- **Dynamic scheduler** — add, edit, enable/disable, and delete scheduled pulls from the UI; no restart required; sorted by time
- **S&P 500 initialization** — load all ~500 S&P 500 tickers in one click
- **Custom tickers** — add any ticker manually
- **Alerts** — set price/change threshold alerts; notifications delivered via WebSocket in real time
- **Top movers** — see biggest gainers and losers from the latest sample
- **CSV export** — export historical samples filtered by ticker and date range
- **Dashboard** — live price table with day-change indicators, auto-refreshing via WebSocket
- **Stock detail** — price and volume history charts with stacked date/time X-axis labels and full timestamp on hover; sample timestamp shown in the stock info header

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Scheduling | APScheduler 3.x (AsyncIOScheduler + CronTrigger) |
| Market data | yfinance 1.2.1 (`yf.download()`, period=1d, interval=1m) |
| Frontend | React 18, TypeScript, Vite 8 |
| Real-time | WebSocket (`/appws`) |

---

## Project Structure

```
stock-trader/
├── backend/
│   ├── main.py              # FastAPI app, lifespan, WebSocket endpoint, default schedule seeding
│   ├── models.py            # SQLAlchemy models (Stock, Sample, Alert, Notification, ScheduledJob)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # SQLite engine with WAL mode + busy_timeout via event listener
│   ├── sampler.py           # yf.download() intraday sampler, 50 tickers/request, 2s delay
│   ├── scheduler.py         # APScheduler setup, dynamic add/remove, 5-min dedup guard
│   ├── alert_engine.py      # Alert evaluation after each sample
│   ├── sp500.py             # S&P 500 ticker fetcher from Wikipedia (httpx + User-Agent)
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
    │   ├── api/client.ts        # Typed fetch wrapper, BASE_URL="" (relative)
    │   ├── utils/time.ts        # parseUTC() — corrects backend UTC timestamps
    │   ├── components/
    │   │   ├── PriceChart.tsx   # Line chart with stacked date/time axis and tooltip timestamps
    │   │   └── VolumeChart.tsx  # Bar chart with stacked date/time axis and tooltip timestamps
    │   ├── hooks/
    │   │   └── useWebSocket.ts  # WebSocket client, path /appws
    │   └── pages/
    │       ├── Dashboard.tsx
    │       ├── StockDetail.tsx  # Sample timestamp in header, price history table
    │       ├── TopMovers.tsx
    │       ├── Alerts.tsx
    │       ├── Notifications.tsx
    │       └── Settings.tsx     # Scheduled pulls (sorted by time), stocks, export, trigger
    └── vite.config.ts           # Proxy /api and /appws to backend port 8000
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

### Windows — quick start

```bat
start.bat   # opens Backend and Frontend in separate terminal windows
stop.bat    # kills both servers
```

### Production build

```bash
cd frontend
npm run build
```

FastAPI serves the built `frontend/dist` as static files — no separate web server needed.

---

## Configuration

### Default schedules

Three schedules are seeded on first startup (UTC times, Eastern approximation shown):

| Label | Sample Type | UTC | ET (approx) |
|-------|-------------|-----|-------------|
| Market Open | open | 13:30 | 9:30 AM |
| Midday | mid | 16:00 | 12:00 PM |
| Market Close | close | 20:00 | 4:00 PM |

Schedules can be freely added, edited, or deleted from **Settings → Scheduled Pulls** and are always displayed sorted by time.

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
| GET | `/api/schedules` | List scheduled jobs (sorted by time) |
| POST | `/api/schedules` | Create a scheduled job |
| PUT | `/api/schedules/{id}` | Update a scheduled job |
| DELETE | `/api/schedules/{id}` | Delete a scheduled job |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |
| GET | `/api/notifications` | List notifications |
| GET | `/api/export/csv` | Export samples as CSV |
| WS | `/appws` | WebSocket for real-time events |

---

## Known Behaviours

- **Intraday only** — `yf.download(period="1d", interval="1m")` returns data only during market hours. Samples taken outside market hours show the last available price.
- **Dedup guard** — if the same `sample_type` runs twice within 5 minutes (e.g. from a hot-reload restart), the second run is silently skipped.
- **Timestamps are UTC** — all timestamps stored in UTC; the frontend converts to local time via `parseUTC()`.

---

## Running Tests

```bash
pytest
```
