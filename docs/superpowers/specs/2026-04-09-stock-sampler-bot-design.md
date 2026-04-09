# Stock Sampler Bot — Design Spec

## Overview

A Python/React application that samples 500 stocks 3 times daily (market open, midday, close), stores snapshots in SQLite with CSV export, and provides a web dashboard with alerts and push notifications.

## Architecture

### Backend (Python + FastAPI)

- **FastAPI** — REST API, WebSocket support, serves built React frontend
- **APScheduler** — schedules 3 daily sample jobs
- **yfinance** — batch stock data fetching
- **SQLAlchemy + SQLite** — ORM and local database
- **Pydantic** — request/response validation

### Frontend (React + TypeScript)

- **Vite + React + TypeScript** — build toolchain
- **Recharts** — price/volume charting
- **Browser Notification API** — push notifications
- **WebSocket** — real-time updates when samples complete

## Schedule

| Sample    | Time (ET)  | Description                  |
|-----------|------------|------------------------------|
| Open      | 9:30 AM    | Market open snapshot         |
| Midday    | 12:00 PM   | Mid-session snapshot         |
| Close     | 4:00 PM    | Market close snapshot        |

## Data Model

### stocks

| Column   | Type    | Description                          |
|----------|---------|--------------------------------------|
| id       | integer | Primary key                          |
| ticker   | string  | Stock symbol (e.g., AAPL)            |
| name     | string  | Company name                         |
| sector   | string  | Industry sector                      |
| source   | string  | "sp500" or "custom"                  |
| active   | boolean | Whether to include in sampling       |

### samples

| Column         | Type     | Description                       |
|----------------|----------|-----------------------------------|
| id             | integer  | Primary key                       |
| stock_id       | integer  | FK to stocks                      |
| sample_type    | string   | "open", "mid", "close"            |
| timestamp      | datetime | When the sample was taken          |
| price          | float    | Current/last price                 |
| volume         | integer  | Trading volume                     |
| bid            | float    | Bid price                          |
| ask            | float    | Ask price                          |
| market_cap     | float    | Market capitalization              |
| day_change_pct | float    | Percentage change for the day      |

### alerts

| Column    | Type    | Description                             |
|-----------|---------|-----------------------------------------|
| id        | integer | Primary key                             |
| stock_id  | integer | FK to stocks (nullable for global)      |
| condition | string  | "price_above", "price_below", "volume_spike", "change_pct" |
| threshold | float   | Trigger value                           |
| enabled   | boolean | Active flag                             |

### notifications

| Column       | Type     | Description                        |
|--------------|----------|------------------------------------|
| id           | integer  | Primary key                        |
| alert_id     | integer  | FK to alerts                       |
| stock_id     | integer  | FK to stocks                       |
| triggered_at | datetime | When the alert fired               |
| message      | string   | Human-readable alert message       |
| read         | boolean  | Dismissed by user                  |

## API Endpoints

### Stocks
- `GET /api/stocks` — list all stocks (filterable by source, active)
- `POST /api/stocks` — add custom ticker
- `PUT /api/stocks/{id}` — update stock (toggle active, edit)
- `DELETE /api/stocks/{id}` — remove custom ticker
- `POST /api/stocks/init-sp500` — populate S&P 500 list

### Samples
- `GET /api/samples` — query samples (filter by ticker, date range, sample_type)
- `GET /api/samples/latest` — latest sample for each stock
- `POST /api/samples/trigger` — manually trigger a sample run

### Alerts
- `GET /api/alerts` — list all alerts
- `POST /api/alerts` — create alert
- `PUT /api/alerts/{id}` — update alert
- `DELETE /api/alerts/{id}` — delete alert

### Notifications
- `GET /api/notifications` — list notifications (filter by read status)
- `PUT /api/notifications/{id}/read` — mark as read
- `PUT /api/notifications/read-all` — mark all as read

### Export
- `GET /api/export/csv` — download filtered sample data as CSV

### WebSocket
- `ws://localhost:8000/ws` — pushes events: sample_complete, alert_triggered

## Sampling Engine

1. Load all active tickers from DB
2. Split into batches of 50 tickers
3. For each batch, call `yfinance.download()` with batch tickers
4. Parse response into sample records
5. Insert samples into DB
6. Evaluate alert conditions against new samples
7. Create notifications for triggered alerts
8. Broadcast `sample_complete` via WebSocket

Error handling: log failures per-ticker, continue with remaining batches. Retry failed tickers once at end of run.

## Frontend Pages

### Dashboard
- Summary cards: total stocks, last sample time, active alerts count
- Sortable/filterable table of latest sample data for all stocks
- Sample status indicator (next scheduled sample countdown)

### Stock Detail
- Historical price chart (line chart via Recharts)
- Volume chart
- All samples table for this stock
- Alert configuration for this stock

### Alerts Management
- List all alerts with status
- Create/edit/delete alerts
- Notification history with dismiss functionality

### Settings
- Add/remove custom tickers
- Trigger manual sample
- Export CSV with date range and ticker filters

## Alert Evaluation

After each sample run:
1. Load all enabled alerts
2. For each alert, compare the new sample value against the threshold
3. Conditions:
   - `price_above`: sample.price > threshold
   - `price_below`: sample.price < threshold
   - `volume_spike`: sample.volume > threshold
   - `change_pct`: abs(sample.day_change_pct) > threshold
4. Create notification record for triggered alerts
5. Push notification via WebSocket to connected clients

## Browser Push Notifications

- Request permission on first dashboard visit
- Trigger `Notification` API when WebSocket receives `alert_triggered` event
- Show stock ticker, condition, and current value in notification body

## CSV Export

- Query parameters: start_date, end_date, tickers (comma-separated), sample_type
- Returns streaming CSV response with all matching sample rows
- Headers: ticker, name, sample_type, timestamp, price, volume, bid, ask, market_cap, day_change_pct

## Stock List Initialization

On first run or manual trigger:
1. Fetch S&P 500 constituents from Wikipedia table (via `pandas.read_html`)
2. Insert all tickers with source="sp500"
3. User can add custom tickers via the UI (source="custom")

## Deployment

- **Phase 1**: Local — `uvicorn` serves backend, Vite dev server or built static files for frontend
- **Phase 2 (future)**: Dockerize backend + frontend, deploy to cloud (structure supports this but not built yet)

## Tech Stack Summary

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy |
| Scheduler  | APScheduler                       |
| Data       | yfinance, pandas                  |
| Database   | SQLite                            |
| Frontend   | React 18, TypeScript, Vite        |
| Charts     | Recharts                          |
| WebSocket  | FastAPI WebSocket                  |
| Notifications | Browser Notification API       |
