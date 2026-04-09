# Stock Sampler Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python/React application that samples 500 stocks 3x daily, stores data in SQLite, and provides a web dashboard with alerts, top movers, and push notifications.

**Architecture:** FastAPI backend with APScheduler for timed sampling, yfinance for data, SQLAlchemy ORM over SQLite. React+TypeScript frontend with Recharts for charting, WebSocket for real-time updates, and browser Notification API for push alerts.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, APScheduler, yfinance, pandas | React 18, TypeScript, Vite, Recharts

---

## File Structure

```
stock-trader/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, mount static, startup/shutdown
│   ├── database.py              # SQLAlchemy engine, session factory, Base
│   ├── models.py                # Stock, Sample, Alert, Notification ORM models
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── sampler.py               # yfinance batch fetching logic
│   ├── scheduler.py             # APScheduler setup and job definitions
│   ├── alert_engine.py          # Alert evaluation after each sample run
│   ├── websocket_manager.py     # WebSocket connection manager and broadcast
│   ├── sp500.py                 # S&P 500 list fetcher from Wikipedia
│   ├── routes/
│   │   ├── stocks.py            # Stock CRUD endpoints
│   │   ├── samples.py           # Sample query + trigger + top movers endpoints
│   │   ├── alerts.py            # Alert CRUD endpoints
│   │   ├── notifications.py     # Notification list + mark read endpoints
│   │   └── export.py            # CSV export endpoint
│   ├── requirements.txt
│   └── tests/
│       ├── conftest.py          # Shared fixtures (test DB, client)
│       ├── test_models.py       # ORM model tests
│       ├── test_sampler.py      # Sampler logic tests
│       ├── test_alert_engine.py # Alert evaluation tests
│       ├── test_sp500.py        # S&P 500 fetcher tests
│       ├── test_stocks_api.py   # Stock endpoint tests
│       ├── test_samples_api.py  # Sample endpoint tests
│       ├── test_alerts_api.py   # Alert endpoint tests
│       ├── test_notifications_api.py # Notification endpoint tests
│       └── test_export_api.py   # CSV export tests
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx             # React entry point
│       ├── App.tsx              # Router setup, layout
│       ├── api/
│       │   └── client.ts        # Fetch wrapper for backend API
│       ├── hooks/
│       │   ├── useWebSocket.ts  # WebSocket connection hook
│       │   └── useNotifications.ts # Browser notification permission hook
│       ├── pages/
│       │   ├── Dashboard.tsx    # Summary cards + stock table
│       │   ├── StockDetail.tsx  # Charts + samples table for one stock
│       │   ├── TopMovers.tsx    # Gainers/losers/active ranked list
│       │   ├── Alerts.tsx       # Alert management + notification history
│       │   └── Settings.tsx     # Ticker management + manual trigger + export
│       └── components/
│           ├── StockTable.tsx   # Sortable/filterable stock table
│           ├── PriceChart.tsx   # Recharts line chart for price history
│           ├── VolumeChart.tsx  # Recharts bar chart for volume
│           ├── Sparkline.tsx    # Mini intraday chart for top movers
│           ├── AlertForm.tsx    # Create/edit alert form
│           ├── NotificationBell.tsx # Notification indicator + dropdown
│           └── Layout.tsx       # Nav bar + page wrapper
└── data/                        # Created at runtime, holds stock_trader.db
```

---

## Task 1: Project Setup & Database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/database.py`
- Create: `backend/models.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
pydantic==2.9.0
yfinance==0.2.43
pandas==2.2.3
apscheduler==3.10.4
lxml==5.3.0
httpx==0.27.0
pytest==8.3.0
pytest-asyncio==0.24.0
```

Run: `cd D:/Development/stock-trader/backend && pip install -r requirements.txt`

- [ ] **Step 2: Create database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATABASE_DIR, exist_ok=True)
DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'stock_trader.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Create models.py**

```python
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    sector = Column(String, default="")
    source = Column(String, nullable=False)  # "sp500" or "custom"
    active = Column(Boolean, default=True)

    samples = relationship("Sample", back_populates="stock", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="stock", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    sample_type = Column(String, nullable=False)  # "open", "mid", "close"
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    price = Column(Float)
    volume = Column(Integer)
    bid = Column(Float)
    ask = Column(Float)
    market_cap = Column(Float)
    day_change_pct = Column(Float)

    stock = relationship("Stock", back_populates="samples")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=True)
    condition = Column(String, nullable=False)  # price_above, price_below, volume_spike, change_pct
    threshold = Column(Float, nullable=False)
    enabled = Column(Boolean, default=True)

    stock = relationship("Stock", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    triggered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False)

    alert = relationship("Alert", back_populates="notifications")
    stock = relationship("Stock")
```

- [ ] **Step 4: Write model tests**

Create `backend/tests/__init__.py` (empty) and `backend/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
```

Create `backend/tests/test_models.py`:

```python
from backend.models import Stock, Sample, Alert, Notification
from datetime import datetime, timezone


def test_create_stock(db_session):
    stock = Stock(ticker="AAPL", name="Apple Inc.", sector="Technology", source="sp500")
    db_session.add(stock)
    db_session.commit()
    assert stock.id is not None
    assert stock.ticker == "AAPL"
    assert stock.active is True


def test_create_sample_linked_to_stock(db_session):
    stock = Stock(ticker="MSFT", name="Microsoft", sector="Technology", source="sp500")
    db_session.add(stock)
    db_session.commit()

    sample = Sample(
        stock_id=stock.id, sample_type="open", price=400.0,
        volume=1000000, bid=399.9, ask=400.1,
        market_cap=3000000000000.0, day_change_pct=1.5,
    )
    db_session.add(sample)
    db_session.commit()

    assert sample.stock.ticker == "MSFT"
    assert len(stock.samples) == 1


def test_create_alert_and_notification(db_session):
    stock = Stock(ticker="GOOG", name="Alphabet", sector="Technology", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="price_above", threshold=150.0)
    db_session.add(alert)
    db_session.commit()

    notification = Notification(
        alert_id=alert.id, stock_id=stock.id,
        message="GOOG exceeded $150.00",
    )
    db_session.add(notification)
    db_session.commit()

    assert notification.alert.condition == "price_above"
    assert notification.read is False


def test_stock_cascade_delete(db_session):
    stock = Stock(ticker="TSLA", name="Tesla", sector="Automotive", source="custom")
    db_session.add(stock)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="close", price=250.0, volume=500000)
    db_session.add(sample)
    db_session.commit()

    db_session.delete(stock)
    db_session.commit()

    assert db_session.query(Sample).count() == 0
```

- [ ] **Step 5: Run tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_models.py -v`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/database.py backend/models.py backend/tests/
git commit -m "feat: add database layer with Stock, Sample, Alert, Notification models"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/schemas.py`

- [ ] **Step 1: Create schemas.py**

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# --- Stock ---
class StockCreate(BaseModel):
    ticker: str
    name: str
    sector: str = ""


class StockUpdate(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None
    active: Optional[bool] = None


class StockResponse(BaseModel):
    id: int
    ticker: str
    name: str
    sector: str
    source: str
    active: bool

    model_config = {"from_attributes": True}


# --- Sample ---
class SampleResponse(BaseModel):
    id: int
    stock_id: int
    sample_type: str
    timestamp: datetime
    price: Optional[float]
    volume: Optional[int]
    bid: Optional[float]
    ask: Optional[float]
    market_cap: Optional[float]
    day_change_pct: Optional[float]

    model_config = {"from_attributes": True}


class SampleWithTicker(SampleResponse):
    ticker: str
    name: str


class TopMoverResponse(BaseModel):
    ticker: str
    name: str
    price: Optional[float]
    volume: Optional[int]
    day_change_pct: Optional[float]
    sparkline: list[Optional[float]]  # [open_price, mid_price, close_price]


# --- Alert ---
class AlertCreate(BaseModel):
    stock_id: Optional[int] = None
    condition: str  # price_above, price_below, volume_spike, change_pct
    threshold: float


class AlertUpdate(BaseModel):
    condition: Optional[str] = None
    threshold: Optional[float] = None
    enabled: Optional[bool] = None


class AlertResponse(BaseModel):
    id: int
    stock_id: Optional[int]
    condition: str
    threshold: float
    enabled: bool
    ticker: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Notification ---
class NotificationResponse(BaseModel):
    id: int
    alert_id: int
    stock_id: int
    triggered_at: datetime
    message: str
    read: bool
    ticker: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Trigger ---
class TriggerRequest(BaseModel):
    sample_type: str = "mid"  # open, mid, close
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add Pydantic request/response schemas"
```

---

## Task 3: S&P 500 Fetcher

**Files:**
- Create: `backend/sp500.py`
- Create: `backend/tests/test_sp500.py`

- [ ] **Step 1: Write the test**

```python
from unittest.mock import patch
import pandas as pd
from backend.sp500 import fetch_sp500_tickers


def test_fetch_sp500_tickers_parses_wikipedia():
    mock_df = pd.DataFrame({
        "Symbol": ["AAPL", "MSFT", "GOOG"],
        "Security": ["Apple Inc.", "Microsoft Corp.", "Alphabet Inc."],
        "GICS Sector": ["Technology", "Technology", "Communication"],
    })

    with patch("pandas.read_html", return_value=[mock_df]):
        result = fetch_sp500_tickers()

    assert len(result) == 3
    assert result[0] == {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology"}
    assert result[2]["ticker"] == "GOOG"


def test_fetch_sp500_cleans_dot_tickers():
    mock_df = pd.DataFrame({
        "Symbol": ["BRK.B", "BF.B"],
        "Security": ["Berkshire Hathaway", "Brown-Forman"],
        "GICS Sector": ["Financials", "Consumer Staples"],
    })

    with patch("pandas.read_html", return_value=[mock_df]):
        result = fetch_sp500_tickers()

    assert result[0]["ticker"] == "BRK-B"
    assert result[1]["ticker"] == "BF-B"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_sp500.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement sp500.py**

```python
import pandas as pd

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


def fetch_sp500_tickers() -> list[dict]:
    tables = pd.read_html(SP500_URL)
    df = tables[0]
    tickers = []
    for _, row in df.iterrows():
        ticker = row["Symbol"].replace(".", "-")
        tickers.append({
            "ticker": ticker,
            "name": row["Security"],
            "sector": row["GICS Sector"],
        })
    return tickers
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_sp500.py -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/sp500.py backend/tests/test_sp500.py
git commit -m "feat: add S&P 500 ticker fetcher from Wikipedia"
```

---

## Task 4: WebSocket Manager

**Files:**
- Create: `backend/websocket_manager.py`

- [ ] **Step 1: Create websocket_manager.py**

```python
from fastapi import WebSocket
import json


class WebSocketManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, event: str, data: dict):
        message = json.dumps({"event": event, "data": data})
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.active_connections.remove(conn)


ws_manager = WebSocketManager()
```

- [ ] **Step 2: Commit**

```bash
git add backend/websocket_manager.py
git commit -m "feat: add WebSocket connection manager with broadcast"
```

---

## Task 5: Alert Engine

**Files:**
- Create: `backend/alert_engine.py`
- Create: `backend/tests/test_alert_engine.py`

- [ ] **Step 1: Write the test**

```python
from backend.alert_engine import evaluate_alerts
from backend.models import Stock, Sample, Alert
from datetime import datetime, timezone


def test_price_above_triggers(db_session):
    stock = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="price_above", threshold=150.0)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="open", price=160.0, volume=1000)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 1
    assert "exceeded" in notifications[0].message


def test_price_below_triggers(db_session):
    stock = Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="price_below", threshold=300.0)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="mid", price=280.0, volume=500)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 1
    assert "dropped below" in notifications[0].message


def test_alert_does_not_trigger_when_condition_not_met(db_session):
    stock = Stock(ticker="GOOG", name="Alphabet", sector="Tech", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="price_above", threshold=200.0)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="close", price=190.0, volume=1000)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 0


def test_volume_spike_triggers(db_session):
    stock = Stock(ticker="TSLA", name="Tesla", sector="Auto", source="custom")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="volume_spike", threshold=1000000)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="open", price=250.0, volume=2000000)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 1


def test_change_pct_triggers(db_session):
    stock = Stock(ticker="NVDA", name="NVIDIA", sector="Tech", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="change_pct", threshold=5.0)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="close", price=800.0, volume=3000000, day_change_pct=-7.5)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 1


def test_disabled_alert_does_not_trigger(db_session):
    stock = Stock(ticker="META", name="Meta", sector="Tech", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=stock.id, condition="price_above", threshold=100.0, enabled=False)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="open", price=500.0, volume=1000)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 0


def test_global_alert_triggers_for_any_stock(db_session):
    stock = Stock(ticker="AMZN", name="Amazon", sector="Consumer", source="sp500")
    db_session.add(stock)
    db_session.commit()

    alert = Alert(stock_id=None, condition="change_pct", threshold=3.0)
    db_session.add(alert)
    db_session.commit()

    sample = Sample(stock_id=stock.id, sample_type="mid", price=180.0, volume=2000000, day_change_pct=4.2)
    db_session.add(sample)
    db_session.commit()

    notifications = evaluate_alerts(db_session, [sample])
    assert len(notifications) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_alert_engine.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement alert_engine.py**

```python
from sqlalchemy.orm import Session
from backend.models import Alert, Notification, Sample


def evaluate_alerts(db: Session, samples: list[Sample]) -> list[Notification]:
    alerts = db.query(Alert).filter(Alert.enabled == True).all()
    notifications = []

    for sample in samples:
        for alert in alerts:
            if alert.stock_id is not None and alert.stock_id != sample.stock_id:
                continue

            triggered = False
            if alert.condition == "price_above" and sample.price is not None:
                triggered = sample.price > alert.threshold
            elif alert.condition == "price_below" and sample.price is not None:
                triggered = sample.price < alert.threshold
            elif alert.condition == "volume_spike" and sample.volume is not None:
                triggered = sample.volume > alert.threshold
            elif alert.condition == "change_pct" and sample.day_change_pct is not None:
                triggered = abs(sample.day_change_pct) > alert.threshold

            if triggered:
                message = _build_message(alert, sample, db)
                notification = Notification(
                    alert_id=alert.id,
                    stock_id=sample.stock_id,
                    message=message,
                )
                db.add(notification)
                notifications.append(notification)

    db.commit()
    return notifications


def _build_message(alert: Alert, sample: Sample, db: Session) -> str:
    from backend.models import Stock
    stock = db.query(Stock).get(sample.stock_id)
    ticker = stock.ticker if stock else "Unknown"

    if alert.condition == "price_above":
        return f"{ticker} exceeded ${alert.threshold:.2f} (current: ${sample.price:.2f})"
    elif alert.condition == "price_below":
        return f"{ticker} dropped below ${alert.threshold:.2f} (current: ${sample.price:.2f})"
    elif alert.condition == "volume_spike":
        return f"{ticker} volume spike: {sample.volume:,} (threshold: {alert.threshold:,.0f})"
    elif alert.condition == "change_pct":
        return f"{ticker} moved {sample.day_change_pct:+.2f}% (threshold: {alert.threshold:.1f}%)"
    return f"{ticker} alert triggered"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_alert_engine.py -v`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/alert_engine.py backend/tests/test_alert_engine.py
git commit -m "feat: add alert evaluation engine with 4 condition types"
```

---

## Task 6: Sampler Engine

**Files:**
- Create: `backend/sampler.py`
- Create: `backend/tests/test_sampler.py`

- [ ] **Step 1: Write the test**

```python
from unittest.mock import patch, MagicMock
import pandas as pd
from backend.models import Stock
from backend.sampler import run_sample


def test_run_sample_creates_sample_records(db_session):
    stock1 = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    stock2 = Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500")
    db_session.add_all([stock1, stock2])
    db_session.commit()

    mock_ticker_aapl = MagicMock()
    mock_ticker_aapl.info = {
        "currentPrice": 175.0,
        "volume": 50000000,
        "bid": 174.9,
        "ask": 175.1,
        "marketCap": 2800000000000,
        "regularMarketChangePercent": 1.2,
    }

    mock_ticker_msft = MagicMock()
    mock_ticker_msft.info = {
        "currentPrice": 420.0,
        "volume": 30000000,
        "bid": 419.8,
        "ask": 420.2,
        "marketCap": 3100000000000,
        "regularMarketChangePercent": -0.5,
    }

    mock_tickers = MagicMock()
    mock_tickers.tickers = {"AAPL": mock_ticker_aapl, "MSFT": mock_ticker_msft}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "open")

    assert len(samples) == 2
    prices = {s.stock.ticker: s.price for s in samples}
    assert prices["AAPL"] == 175.0
    assert prices["MSFT"] == 420.0


def test_run_sample_skips_inactive_stocks(db_session):
    active = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500", active=True)
    inactive = Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500", active=False)
    db_session.add_all([active, inactive])
    db_session.commit()

    mock_ticker = MagicMock()
    mock_ticker.info = {
        "currentPrice": 175.0, "volume": 50000000, "bid": 174.9,
        "ask": 175.1, "marketCap": 2800000000000, "regularMarketChangePercent": 1.2,
    }

    mock_tickers = MagicMock()
    mock_tickers.tickers = {"AAPL": mock_ticker}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "open")

    assert len(samples) == 1
    assert samples[0].stock.ticker == "AAPL"


def test_run_sample_handles_failed_ticker(db_session):
    stock = Stock(ticker="BADTICKER", name="Bad", sector="N/A", source="custom")
    db_session.add(stock)
    db_session.commit()

    mock_ticker = MagicMock()
    mock_ticker.info = {}  # No data returned

    mock_tickers = MagicMock()
    mock_tickers.tickers = {"BADTICKER": mock_ticker}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "mid")

    assert len(samples) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_sampler.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement sampler.py**

```python
import yfinance as yf
import logging
from sqlalchemy.orm import Session
from backend.models import Stock, Sample

logger = logging.getLogger(__name__)
BATCH_SIZE = 50


def run_sample(db: Session, sample_type: str) -> list[Sample]:
    stocks = db.query(Stock).filter(Stock.active == True).all()
    if not stocks:
        logger.warning("No active stocks to sample")
        return []

    ticker_to_stock = {s.ticker: s for s in stocks}
    tickers = list(ticker_to_stock.keys())
    all_samples = []
    failed_tickers = []

    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i : i + BATCH_SIZE]
        batch_samples, batch_failed = _fetch_batch(db, batch, ticker_to_stock, sample_type)
        all_samples.extend(batch_samples)
        failed_tickers.extend(batch_failed)

    # Retry failed tickers once
    if failed_tickers:
        logger.info(f"Retrying {len(failed_tickers)} failed tickers")
        retry_samples, _ = _fetch_batch(db, failed_tickers, ticker_to_stock, sample_type)
        all_samples.extend(retry_samples)

    db.commit()
    return all_samples


def _fetch_batch(
    db: Session, tickers: list[str], ticker_to_stock: dict, sample_type: str
) -> tuple[list[Sample], list[str]]:
    samples = []
    failed = []

    try:
        yf_tickers = yf.Tickers(" ".join(tickers))
    except Exception as e:
        logger.error(f"yfinance batch fetch failed: {e}")
        return [], tickers

    for ticker in tickers:
        try:
            yf_ticker = yf_tickers.tickers.get(ticker)
            if yf_ticker is None:
                failed.append(ticker)
                continue

            info = yf_ticker.info
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            if price is None:
                failed.append(ticker)
                continue

            stock = ticker_to_stock[ticker]
            sample = Sample(
                stock_id=stock.id,
                sample_type=sample_type,
                price=price,
                volume=info.get("volume") or info.get("regularMarketVolume"),
                bid=info.get("bid"),
                ask=info.get("ask"),
                market_cap=info.get("marketCap"),
                day_change_pct=info.get("regularMarketChangePercent"),
            )
            db.add(sample)
            samples.append(sample)
        except Exception as e:
            logger.error(f"Failed to process {ticker}: {e}")
            failed.append(ticker)

    return samples, failed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_sampler.py -v`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/sampler.py backend/tests/test_sampler.py
git commit -m "feat: add stock sampler engine with batch fetching and retry"
```

---

## Task 7: Stock Routes

**Files:**
- Create: `backend/routes/__init__.py` (empty)
- Create: `backend/routes/stocks.py`
- Create: `backend/tests/test_stocks_api.py`

- [ ] **Step 1: Write the test**

Create `backend/tests/test_stocks_api.py`:

```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_create_custom_stock():
    resp = client.post("/api/stocks", json={"ticker": "PLTR", "name": "Palantir", "sector": "Tech"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "PLTR"
    assert data["source"] == "custom"


def test_list_stocks():
    client.post("/api/stocks", json={"ticker": "AAPL", "name": "Apple"})
    client.post("/api/stocks", json={"ticker": "MSFT", "name": "Microsoft"})
    resp = client.get("/api/stocks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_stock():
    resp = client.post("/api/stocks", json={"ticker": "GOOG", "name": "Alphabet"})
    stock_id = resp.json()["id"]
    resp = client.put(f"/api/stocks/{stock_id}", json={"active": False})
    assert resp.status_code == 200
    assert resp.json()["active"] is False


def test_delete_stock():
    resp = client.post("/api/stocks", json={"ticker": "NFLX", "name": "Netflix"})
    stock_id = resp.json()["id"]
    resp = client.delete(f"/api/stocks/{stock_id}")
    assert resp.status_code == 200
    resp = client.get("/api/stocks")
    assert len(resp.json()) == 0


def test_duplicate_ticker_rejected():
    client.post("/api/stocks", json={"ticker": "AAPL", "name": "Apple"})
    resp = client.post("/api/stocks", json={"ticker": "AAPL", "name": "Apple Again"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Create routes/stocks.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Stock
from backend.schemas import StockCreate, StockUpdate, StockResponse
from backend.sp500 import fetch_sp500_tickers

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("", response_model=list[StockResponse])
def list_stocks(source: str = None, active: bool = None, db: Session = Depends(get_db)):
    query = db.query(Stock)
    if source:
        query = query.filter(Stock.source == source)
    if active is not None:
        query = query.filter(Stock.active == active)
    return query.order_by(Stock.ticker).all()


@router.post("", response_model=StockResponse)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    existing = db.query(Stock).filter(Stock.ticker == stock.ticker.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ticker {stock.ticker} already exists")
    db_stock = Stock(
        ticker=stock.ticker.upper(),
        name=stock.name,
        sector=stock.sector,
        source="custom",
    )
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock


@router.put("/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, update: StockUpdate, db: Session = Depends(get_db)):
    stock = db.query(Stock).get(stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(stock, field, value)
    db.commit()
    db.refresh(stock)
    return stock


@router.delete("/{stock_id}")
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.query(Stock).get(stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    db.delete(stock)
    db.commit()
    return {"detail": "deleted"}


@router.post("/init-sp500")
def init_sp500(db: Session = Depends(get_db)):
    tickers = fetch_sp500_tickers()
    added = 0
    for t in tickers:
        existing = db.query(Stock).filter(Stock.ticker == t["ticker"]).first()
        if not existing:
            db.add(Stock(ticker=t["ticker"], name=t["name"], sector=t["sector"], source="sp500"))
            added += 1
    db.commit()
    return {"detail": f"Added {added} S&P 500 stocks"}
```

- [ ] **Step 3: Create minimal main.py to support the test**

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from backend.database import engine, Base
from backend.websocket_manager import ws_manager
from backend.routes import stocks, samples, alerts, notifications, export

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Sampler Bot")

app.include_router(stocks.router)
app.include_router(samples.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(export.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
```

Note: This requires stub route files for samples, alerts, notifications, export. Create them now as empty routers:

Create `backend/routes/samples.py`:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/samples", tags=["samples"])
```

Create `backend/routes/alerts.py`:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/alerts", tags=["alerts"])
```

Create `backend/routes/notifications.py`:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/notifications", tags=["notifications"])
```

Create `backend/routes/export.py`:
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/export", tags=["export"])
```

- [ ] **Step 4: Run tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_stocks_api.py -v`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/routes/ backend/tests/test_stocks_api.py
git commit -m "feat: add stock CRUD routes with S&P 500 initialization"
```

---

## Task 8: Sample Routes (including Top Movers)

**Files:**
- Modify: `backend/routes/samples.py`
- Create: `backend/tests/test_samples_api.py`

- [ ] **Step 1: Write the test**

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Sample
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def _seed_stocks_and_samples():
    db = TestSession()
    stocks = [
        Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500"),
        Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500"),
        Stock(ticker="TSLA", name="Tesla", sector="Auto", source="custom"),
    ]
    db.add_all(stocks)
    db.commit()
    for stock in stocks:
        db.refresh(stock)

    samples = [
        Sample(stock_id=stocks[0].id, sample_type="open", price=175.0, volume=50000000, day_change_pct=3.5),
        Sample(stock_id=stocks[0].id, sample_type="mid", price=178.0, volume=55000000, day_change_pct=5.2),
        Sample(stock_id=stocks[1].id, sample_type="open", price=420.0, volume=30000000, day_change_pct=-2.1),
        Sample(stock_id=stocks[2].id, sample_type="open", price=250.0, volume=80000000, day_change_pct=8.0),
    ]
    db.add_all(samples)
    db.commit()
    db.close()


def test_get_latest_samples():
    _seed_stocks_and_samples()
    resp = client.get("/api/samples/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2


def test_get_samples_filtered_by_ticker():
    _seed_stocks_and_samples()
    resp = client.get("/api/samples", params={"ticker": "AAPL"})
    assert resp.status_code == 200
    assert all(s["ticker"] == "AAPL" for s in resp.json())


def test_top_movers_gainers():
    _seed_stocks_and_samples()
    resp = client.get("/api/samples/top-movers", params={"type": "gainers", "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    # Should be sorted descending by day_change_pct
    for i in range(len(data) - 1):
        assert data[i]["day_change_pct"] >= data[i + 1]["day_change_pct"]


def test_top_movers_losers():
    _seed_stocks_and_samples()
    resp = client.get("/api/samples/top-movers", params={"type": "losers", "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for i in range(len(data) - 1):
        assert data[i]["day_change_pct"] <= data[i + 1]["day_change_pct"]


def test_top_movers_active():
    _seed_stocks_and_samples()
    resp = client.get("/api/samples/top-movers", params={"type": "active", "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for i in range(len(data) - 1):
        assert data[i]["volume"] >= data[i + 1]["volume"]
```

- [ ] **Step 2: Implement samples.py**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from datetime import datetime, timezone
from backend.database import get_db
from backend.models import Stock, Sample
from backend.schemas import SampleResponse, SampleWithTicker, TopMoverResponse, TriggerRequest
from backend.sampler import run_sample
from backend.alert_engine import evaluate_alerts
from backend.websocket_manager import ws_manager
import asyncio

router = APIRouter(prefix="/api/samples", tags=["samples"])


@router.get("", response_model=list[SampleWithTicker])
def list_samples(
    ticker: str = None,
    sample_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Sample).join(Stock)
    if ticker:
        query = query.filter(Stock.ticker == ticker.upper())
    if sample_type:
        query = query.filter(Sample.sample_type == sample_type)
    if start_date:
        query = query.filter(Sample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Sample.timestamp <= datetime.fromisoformat(end_date))

    rows = query.order_by(desc(Sample.timestamp)).limit(1000).all()
    return [
        SampleWithTicker(
            id=s.id, stock_id=s.stock_id, sample_type=s.sample_type,
            timestamp=s.timestamp, price=s.price, volume=s.volume,
            bid=s.bid, ask=s.ask, market_cap=s.market_cap,
            day_change_pct=s.day_change_pct,
            ticker=s.stock.ticker, name=s.stock.name,
        )
        for s in rows
    ]


@router.get("/latest", response_model=list[SampleWithTicker])
def latest_samples(db: Session = Depends(get_db)):
    subq = (
        db.query(Sample.stock_id, func.max(Sample.id).label("max_id"))
        .group_by(Sample.stock_id)
        .subquery()
    )
    rows = (
        db.query(Sample)
        .join(subq, Sample.id == subq.c.max_id)
        .join(Stock)
        .order_by(Stock.ticker)
        .all()
    )
    return [
        SampleWithTicker(
            id=s.id, stock_id=s.stock_id, sample_type=s.sample_type,
            timestamp=s.timestamp, price=s.price, volume=s.volume,
            bid=s.bid, ask=s.ask, market_cap=s.market_cap,
            day_change_pct=s.day_change_pct,
            ticker=s.stock.ticker, name=s.stock.name,
        )
        for s in rows
    ]


@router.get("/top-movers", response_model=list[TopMoverResponse])
def top_movers(type: str = "gainers", limit: int = 10, db: Session = Depends(get_db)):
    # Get latest sample per stock
    subq = (
        db.query(Sample.stock_id, func.max(Sample.id).label("max_id"))
        .group_by(Sample.stock_id)
        .subquery()
    )
    query = db.query(Sample).join(subq, Sample.id == subq.c.max_id).join(Stock)

    if type == "gainers":
        query = query.filter(Sample.day_change_pct != None).order_by(desc(Sample.day_change_pct))
    elif type == "losers":
        query = query.filter(Sample.day_change_pct != None).order_by(asc(Sample.day_change_pct))
    elif type == "active":
        query = query.filter(Sample.volume != None).order_by(desc(Sample.volume))
    else:
        raise HTTPException(status_code=400, detail="type must be gainers, losers, or active")

    rows = query.limit(limit).all()

    results = []
    for s in rows:
        # Build sparkline from today's samples for this stock
        today_samples = (
            db.query(Sample)
            .filter(Sample.stock_id == s.stock_id)
            .filter(Sample.sample_type.in_(["open", "mid", "close"]))
            .order_by(desc(Sample.timestamp))
            .limit(3)
            .all()
        )
        sparkline_map = {ts.sample_type: ts.price for ts in today_samples}
        sparkline = [sparkline_map.get("open"), sparkline_map.get("mid"), sparkline_map.get("close")]

        results.append(TopMoverResponse(
            ticker=s.stock.ticker,
            name=s.stock.name,
            price=s.price,
            volume=s.volume,
            day_change_pct=s.day_change_pct,
            sparkline=sparkline,
        ))

    return results


@router.post("/trigger")
async def trigger_sample(req: TriggerRequest, db: Session = Depends(get_db)):
    samples = run_sample(db, req.sample_type)
    notifications = evaluate_alerts(db, samples)
    await ws_manager.broadcast("sample_complete", {
        "sample_type": req.sample_type,
        "count": len(samples),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    for n in notifications:
        await ws_manager.broadcast("alert_triggered", {
            "message": n.message,
            "stock_id": n.stock_id,
            "triggered_at": n.triggered_at.isoformat() if n.triggered_at else None,
        })
    return {"detail": f"Sampled {len(samples)} stocks, {len(notifications)} alerts triggered"}
```

- [ ] **Step 3: Run tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_samples_api.py -v`
Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/samples.py backend/tests/test_samples_api.py
git commit -m "feat: add sample query, latest, top movers, and trigger endpoints"
```

---

## Task 9: Alert & Notification Routes

**Files:**
- Modify: `backend/routes/alerts.py`
- Modify: `backend/routes/notifications.py`
- Create: `backend/tests/test_alerts_api.py`
- Create: `backend/tests/test_notifications_api.py`

- [ ] **Step 1: Write alert tests**

```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestSession()
    db.add(Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500"))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_create_alert():
    resp = client.post("/api/alerts", json={"stock_id": 1, "condition": "price_above", "threshold": 200.0})
    assert resp.status_code == 200
    assert resp.json()["condition"] == "price_above"


def test_create_global_alert():
    resp = client.post("/api/alerts", json={"condition": "change_pct", "threshold": 5.0})
    assert resp.status_code == 200
    assert resp.json()["stock_id"] is None


def test_list_alerts():
    client.post("/api/alerts", json={"stock_id": 1, "condition": "price_above", "threshold": 200.0})
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_update_alert():
    resp = client.post("/api/alerts", json={"stock_id": 1, "condition": "price_below", "threshold": 100.0})
    alert_id = resp.json()["id"]
    resp = client.put(f"/api/alerts/{alert_id}", json={"enabled": False})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


def test_delete_alert():
    resp = client.post("/api/alerts", json={"stock_id": 1, "condition": "volume_spike", "threshold": 1000000})
    alert_id = resp.json()["id"]
    resp = client.delete(f"/api/alerts/{alert_id}")
    assert resp.status_code == 200
```

- [ ] **Step 2: Implement alerts.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Alert, Stock
from backend.schemas import AlertCreate, AlertUpdate, AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).all()
    return [
        AlertResponse(
            id=a.id, stock_id=a.stock_id, condition=a.condition,
            threshold=a.threshold, enabled=a.enabled,
            ticker=a.stock.ticker if a.stock else None,
        )
        for a in alerts
    ]


@router.post("", response_model=AlertResponse)
def create_alert(alert: AlertCreate, db: Session = Depends(get_db)):
    if alert.stock_id:
        stock = db.query(Stock).get(alert.stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
    db_alert = Alert(
        stock_id=alert.stock_id,
        condition=alert.condition,
        threshold=alert.threshold,
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return AlertResponse(
        id=db_alert.id, stock_id=db_alert.stock_id, condition=db_alert.condition,
        threshold=db_alert.threshold, enabled=db_alert.enabled,
        ticker=db_alert.stock.ticker if db_alert.stock else None,
    )


@router.put("/{alert_id}", response_model=AlertResponse)
def update_alert(alert_id: int, update: AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(alert, field, value)
    db.commit()
    db.refresh(alert)
    return AlertResponse(
        id=alert.id, stock_id=alert.stock_id, condition=alert.condition,
        threshold=alert.threshold, enabled=alert.enabled,
        ticker=alert.stock.ticker if alert.stock else None,
    )


@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"detail": "deleted"}
```

- [ ] **Step 3: Write notification tests**

```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Alert, Notification
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestSession()
    stock = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    db.add(stock)
    db.commit()
    alert = Alert(stock_id=stock.id, condition="price_above", threshold=200.0)
    db.add(alert)
    db.commit()
    notification = Notification(alert_id=alert.id, stock_id=stock.id, message="AAPL exceeded $200.00")
    db.add(notification)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_list_notifications():
    resp = client.get("/api/notifications")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_mark_notification_read():
    resp = client.get("/api/notifications")
    notif_id = resp.json()[0]["id"]
    resp = client.put(f"/api/notifications/{notif_id}/read")
    assert resp.status_code == 200
    assert resp.json()["read"] is True


def test_mark_all_read():
    resp = client.put("/api/notifications/read-all")
    assert resp.status_code == 200
    resp = client.get("/api/notifications")
    assert all(n["read"] for n in resp.json())
```

- [ ] **Step 4: Implement notifications.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Notification, Stock
from backend.schemas import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(read: bool = None, db: Session = Depends(get_db)):
    query = db.query(Notification)
    if read is not None:
        query = query.filter(Notification.read == read)
    rows = query.order_by(Notification.triggered_at.desc()).limit(100).all()
    return [
        NotificationResponse(
            id=n.id, alert_id=n.alert_id, stock_id=n.stock_id,
            triggered_at=n.triggered_at, message=n.message, read=n.read,
            ticker=n.stock.ticker if n.stock else None,
        )
        for n in rows
    ]


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).get(notification_id)
    n.read = True
    db.commit()
    db.refresh(n)
    return NotificationResponse(
        id=n.id, alert_id=n.alert_id, stock_id=n.stock_id,
        triggered_at=n.triggered_at, message=n.message, read=n.read,
        ticker=n.stock.ticker if n.stock else None,
    )


@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.read == False).update({"read": True})
    db.commit()
    return {"detail": "all marked as read"}
```

- [ ] **Step 5: Run tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_alerts_api.py backend/tests/test_notifications_api.py -v`
Expected: 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routes/alerts.py backend/routes/notifications.py backend/tests/test_alerts_api.py backend/tests/test_notifications_api.py
git commit -m "feat: add alert CRUD and notification management endpoints"
```

---

## Task 10: CSV Export Route

**Files:**
- Modify: `backend/routes/export.py`
- Create: `backend/tests/test_export_api.py`

- [ ] **Step 1: Write the test**

```python
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Sample
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestSession()
    stock = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    db.add(stock)
    db.commit()
    sample = Sample(stock_id=stock.id, sample_type="open", price=175.0, volume=50000000,
                    bid=174.9, ask=175.1, market_cap=2800000000000.0, day_change_pct=1.2)
    db.add(sample)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_export_csv():
    resp = client.get("/api/export/csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    lines = resp.text.strip().split("\n")
    assert len(lines) == 2  # header + 1 row
    assert "AAPL" in lines[1]
    assert "ticker" in lines[0]


def test_export_csv_filtered_by_ticker():
    resp = client.get("/api/export/csv", params={"tickers": "AAPL"})
    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    assert len(lines) == 2
```

- [ ] **Step 2: Implement export.py**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from backend.database import get_db
from backend.models import Sample, Stock
import csv
import io

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/csv")
def export_csv(
    tickers: str = None,
    sample_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Sample).join(Stock)

    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",")]
        query = query.filter(Stock.ticker.in_(ticker_list))
    if sample_type:
        query = query.filter(Sample.sample_type == sample_type)
    if start_date:
        query = query.filter(Sample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Sample.timestamp <= datetime.fromisoformat(end_date))

    rows = query.order_by(Sample.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ticker", "name", "sample_type", "timestamp", "price", "volume",
                      "bid", "ask", "market_cap", "day_change_pct"])
    for s in rows:
        writer.writerow([
            s.stock.ticker, s.stock.name, s.sample_type,
            s.timestamp.isoformat() if s.timestamp else "",
            s.price, s.volume, s.bid, s.ask, s.market_cap, s.day_change_pct,
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_samples.csv"},
    )
```

- [ ] **Step 3: Run tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/test_export_api.py -v`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/export.py backend/tests/test_export_api.py
git commit -m "feat: add CSV export endpoint with filtering"
```

---

## Task 11: Scheduler

**Files:**
- Create: `backend/scheduler.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create scheduler.py**

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.database import SessionLocal
from backend.sampler import run_sample
from backend.alert_engine import evaluate_alerts
from backend.websocket_manager import ws_manager
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _run_scheduled_sample(sample_type: str):
    logger.info(f"Running scheduled {sample_type} sample")
    db = SessionLocal()
    try:
        samples = run_sample(db, sample_type)
        notifications = evaluate_alerts(db, samples)
        await ws_manager.broadcast("sample_complete", {
            "sample_type": sample_type,
            "count": len(samples),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        for n in notifications:
            await ws_manager.broadcast("alert_triggered", {
                "message": n.message,
                "stock_id": n.stock_id,
                "triggered_at": n.triggered_at.isoformat() if n.triggered_at else None,
            })
        logger.info(f"Completed {sample_type}: {len(samples)} stocks, {len(notifications)} alerts")
    except Exception as e:
        logger.error(f"Scheduled sample {sample_type} failed: {e}")
    finally:
        db.close()


def setup_scheduler():
    # Market open: 9:30 AM ET (13:30 UTC during EDT, 14:30 UTC during EST)
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=13, minute=30, timezone="UTC"),
        args=["open"], id="sample_open", replace_existing=True,
    )
    # Midday: 12:00 PM ET (16:00 UTC during EDT)
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=16, minute=0, timezone="UTC"),
        args=["mid"], id="sample_mid", replace_existing=True,
    )
    # Market close: 4:00 PM ET (20:00 UTC during EDT)
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=20, minute=0, timezone="UTC"),
        args=["close"], id="sample_close", replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with 3 daily sample jobs")
```

- [ ] **Step 2: Update main.py with scheduler lifecycle and CORS**

Replace `backend/main.py` with:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.database import engine, Base
from backend.websocket_manager import ws_manager
from backend.scheduler import setup_scheduler, scheduler
from backend.routes import stocks, samples, alerts, notifications, export
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    setup_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Sampler Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(samples.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(export.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# Serve frontend static files in production
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
```

- [ ] **Step 3: Run all backend tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/scheduler.py backend/main.py
git commit -m "feat: add APScheduler with 3 daily sample jobs and CORS config"
```

---

## Task 12: Frontend Scaffolding

**Files:**
- Create: `frontend/` (Vite + React + TypeScript project)
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useNotifications.ts`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd D:/Development/stock-trader
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom recharts
npm install -D @types/react-router-dom
```

- [ ] **Step 2: Create API client**

Create `frontend/src/api/client.ts`:

```typescript
const BASE_URL = "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || resp.statusText);
  }
  return resp.json();
}

export const api = {
  // Stocks
  getStocks: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/stocks${qs}`);
  },
  createStock: (data: { ticker: string; name: string; sector?: string }) =>
    request<any>("/api/stocks", { method: "POST", body: JSON.stringify(data) }),
  updateStock: (id: number, data: Record<string, any>) =>
    request<any>(`/api/stocks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStock: (id: number) =>
    request<any>(`/api/stocks/${id}`, { method: "DELETE" }),
  initSp500: () =>
    request<any>("/api/stocks/init-sp500", { method: "POST" }),

  // Samples
  getSamples: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/samples${qs}`);
  },
  getLatestSamples: () => request<any[]>("/api/samples/latest"),
  getTopMovers: (type: string = "gainers", limit: number = 10) =>
    request<any[]>(`/api/samples/top-movers?type=${type}&limit=${limit}`),
  triggerSample: (sampleType: string = "mid") =>
    request<any>("/api/samples/trigger", {
      method: "POST",
      body: JSON.stringify({ sample_type: sampleType }),
    }),

  // Alerts
  getAlerts: () => request<any[]>("/api/alerts"),
  createAlert: (data: { stock_id?: number; condition: string; threshold: number }) =>
    request<any>("/api/alerts", { method: "POST", body: JSON.stringify(data) }),
  updateAlert: (id: number, data: Record<string, any>) =>
    request<any>(`/api/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAlert: (id: number) =>
    request<any>(`/api/alerts/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/api/notifications${qs}`);
  },
  markRead: (id: number) =>
    request<any>(`/api/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () =>
    request<any>("/api/notifications/read-all", { method: "PUT" }),

  // Export
  exportCsvUrl: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return `${BASE_URL}/api/export/csv${qs}`;
  },
};
```

- [ ] **Step 3: Create WebSocket hook**

Create `frontend/src/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useRef, useCallback, useState } from "react";

type WsMessage = {
  event: string;
  data: any;
};

export function useWebSocket(onMessage?: (msg: WsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // Reconnect after 3s
    };
    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        onMessage?.(msg);
      } catch {}
    };

    wsRef.current = ws;
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { connected };
}
```

- [ ] **Step 4: Create browser notifications hook**

Create `frontend/src/hooks/useNotifications.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return "denied" as NotificationPermission;
  }, []);

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (permission === "granted") {
        new Notification(title, { body, icon: "/vite.svg" });
      }
    },
    [permission]
  );

  return { permission, requestPermission, showNotification };
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with API client, WebSocket and notification hooks"
```

---

## Task 13: Layout & Routing

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/NotificationBell.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create Layout component**

```tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/top-movers", label: "Top Movers" },
  { path: "/alerts", label: "Alerts" },
  { path: "/settings", label: "Settings" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56, background: "#1a1a2e", color: "#fff",
      }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Stock Sampler</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                color: location.pathname === item.path ? "#4fc3f7" : "#ccc",
                textDecoration: "none", fontSize: 14,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <NotificationBell />
      </nav>
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create NotificationBell**

```tsx
import { useState, useEffect } from "react";
import { api } from "../api/client";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api.getNotifications().then(setNotifications).catch(() => {});
  }, []);

  const handleMarkAllRead = async () => {
    await api.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", color: "#fff",
          cursor: "pointer", fontSize: 18, position: "relative",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -8, background: "#e53935",
            borderRadius: "50%", padding: "2px 6px", fontSize: 10, color: "#fff",
          }}>
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 36, background: "#fff",
          border: "1px solid #ddd", borderRadius: 8, width: 320,
          maxHeight: 400, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 100,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", padding: "8px 12px",
            borderBottom: "1px solid #eee",
          }}>
            <strong>Notifications</strong>
            <button onClick={handleMarkAllRead} style={{
              background: "none", border: "none", color: "#1976d2",
              cursor: "pointer", fontSize: 12,
            }}>
              Mark all read
            </button>
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: 16, color: "#999", textAlign: "center" }}>No notifications</div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "8px 12px", borderBottom: "1px solid #f0f0f0",
                background: n.read ? "#fff" : "#e3f2fd",
              }}
            >
              <div style={{ fontSize: 13 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {new Date(n.triggered_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Set up App.tsx with routing**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { StockDetail } from "./pages/StockDetail";
import { TopMovers } from "./pages/TopMovers";
import { Alerts } from "./pages/Alerts";
import { Settings } from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetail />} />
          <Route path="/top-movers" element={<TopMovers />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Update main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Create stub page files so imports resolve**

Create each page file with a placeholder that will be fully implemented in the next tasks:

`frontend/src/pages/Dashboard.tsx`:
```tsx
export function Dashboard() {
  return <div><h1>Dashboard</h1><p>Loading...</p></div>;
}
```

`frontend/src/pages/StockDetail.tsx`:
```tsx
export function StockDetail() {
  return <div><h1>Stock Detail</h1></div>;
}
```

`frontend/src/pages/TopMovers.tsx`:
```tsx
export function TopMovers() {
  return <div><h1>Top Movers</h1></div>;
}
```

`frontend/src/pages/Alerts.tsx`:
```tsx
export function Alerts() {
  return <div><h1>Alerts</h1></div>;
}
```

`frontend/src/pages/Settings.tsx`:
```tsx
export function Settings() {
  return <div><h1>Settings</h1></div>;
}
```

- [ ] **Step 6: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: add layout, routing, and notification bell component"
```

---

## Task 14: Dashboard Page

**Files:**
- Create: `frontend/src/components/StockTable.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create StockTable component**

```tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type Sample = {
  ticker: string;
  name: string;
  price: number | null;
  volume: number | null;
  day_change_pct: number | null;
  sample_type: string;
  timestamp: string;
};

type SortKey = "ticker" | "price" | "volume" | "day_change_pct";

export function StockTable({ samples }: { samples: Sample[] }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    let data = samples;
    if (filter) {
      const f = filter.toUpperCase();
      data = data.filter((s) => s.ticker.includes(f) || s.name.toUpperCase().includes(f));
    }
    data.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [samples, sortKey, sortAsc, filter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const thStyle = {
    cursor: "pointer", padding: "8px 12px", textAlign: "left" as const,
    borderBottom: "2px solid #ddd", background: "#fafafa", userSelect: "none" as const,
  };
  const tdStyle = { padding: "8px 12px", borderBottom: "1px solid #eee" };

  return (
    <div>
      <input
        type="text" placeholder="Filter by ticker or name..."
        value={filter} onChange={(e) => setFilter(e.target.value)}
        style={{ padding: "8px 12px", marginBottom: 12, width: 300, border: "1px solid #ddd", borderRadius: 4 }}
      />
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
        <thead>
          <tr>
            <th style={thStyle} onClick={() => toggleSort("ticker")}>Ticker {sortKey === "ticker" ? (sortAsc ? "▲" : "▼") : ""}</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle} onClick={() => toggleSort("price")}>Price {sortKey === "price" ? (sortAsc ? "▲" : "▼") : ""}</th>
            <th style={thStyle} onClick={() => toggleSort("volume")}>Volume {sortKey === "volume" ? (sortAsc ? "▲" : "▼") : ""}</th>
            <th style={thStyle} onClick={() => toggleSort("day_change_pct")}>Change % {sortKey === "day_change_pct" ? (sortAsc ? "▲" : "▼") : ""}</th>
            <th style={thStyle}>Type</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr
              key={s.ticker}
              onClick={() => navigate(`/stock/${s.ticker}`)}
              style={{ cursor: "pointer" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <td style={{ ...tdStyle, fontWeight: 600 }}>{s.ticker}</td>
              <td style={tdStyle}>{s.name}</td>
              <td style={tdStyle}>{s.price != null ? `$${s.price.toFixed(2)}` : "—"}</td>
              <td style={tdStyle}>{s.volume != null ? s.volume.toLocaleString() : "—"}</td>
              <td style={{
                ...tdStyle,
                color: (s.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828",
                fontWeight: 600,
              }}>
                {s.day_change_pct != null ? `${s.day_change_pct >= 0 ? "+" : ""}${s.day_change_pct.toFixed(2)}%` : "—"}
              </td>
              <td style={tdStyle}>{s.sample_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Implement Dashboard page**

```tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { StockTable } from "../components/StockTable";
import { useWebSocket } from "../hooks/useWebSocket";
import { useBrowserNotifications } from "../hooks/useNotifications";

export function Dashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, lastSample: "", alertCount: 0 });
  const [loading, setLoading] = useState(true);
  const { permission, requestPermission, showNotification } = useBrowserNotifications();

  const loadData = async () => {
    try {
      const [latest, alerts] = await Promise.all([
        api.getLatestSamples(),
        api.getAlerts(),
      ]);
      setSamples(latest);
      setStats({
        total: latest.length,
        lastSample: latest[0]?.timestamp ? new Date(latest[0].timestamp).toLocaleString() : "Never",
        alertCount: alerts.filter((a: any) => a.enabled).length,
      });
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const onWsMessage = useCallback((msg: { event: string; data: any }) => {
    if (msg.event === "sample_complete") {
      loadData();
    }
    if (msg.event === "alert_triggered") {
      showNotification("Stock Alert", msg.data.message);
    }
  }, [showNotification]);

  useWebSocket(onWsMessage);

  const cardStyle = {
    background: "#fff", borderRadius: 8, padding: "16px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)", flex: 1,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        {permission !== "granted" && (
          <button onClick={requestPermission} style={{
            padding: "8px 16px", background: "#1976d2", color: "#fff",
            border: "none", borderRadius: 4, cursor: "pointer",
          }}>
            Enable Notifications
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "#666" }}>Total Stocks</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "#666" }}>Last Sample</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{stats.lastSample}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: "#666" }}>Active Alerts</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.alertCount}</div>
        </div>
      </div>

      {loading ? <p>Loading...</p> : <StockTable samples={samples} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Dashboard page with stock table, summary cards, and WebSocket updates"
```

---

## Task 15: Stock Detail Page

**Files:**
- Create: `frontend/src/components/PriceChart.tsx`
- Create: `frontend/src/components/VolumeChart.tsx`
- Modify: `frontend/src/pages/StockDetail.tsx`

- [ ] **Step 1: Create PriceChart**

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DataPoint = { timestamp: string; price: number | null };

export function PriceChart({ data }: { data: DataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} />
        <Line type="monotone" dataKey="price" stroke="#1976d2" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create VolumeChart**

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DataPoint = { timestamp: string; volume: number | null };

export function VolumeChart({ data }: { data: DataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip formatter={(val: number) => val.toLocaleString()} />
        <Bar dataKey="volume" fill="#42a5f5" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Implement StockDetail page**

```tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { PriceChart } from "../components/PriceChart";
import { VolumeChart } from "../components/VolumeChart";

export function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    api.getSamples({ ticker }).then((data) => {
      setSamples(data);
      setLoading(false);
    });
  }, [ticker]);

  if (loading) return <p>Loading...</p>;
  if (samples.length === 0) return <p>No data for {ticker}</p>;

  const latest = samples[0];
  const chartData = [...samples].reverse();

  return (
    <div>
      <Link to="/" style={{ color: "#1976d2", textDecoration: "none", fontSize: 14 }}>← Back to Dashboard</Link>
      <h1 style={{ margin: "8px 0" }}>{ticker} — {latest.name}</h1>
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        <div>
          <span style={{ color: "#666", fontSize: 13 }}>Price: </span>
          <strong>${latest.price?.toFixed(2) ?? "—"}</strong>
        </div>
        <div>
          <span style={{ color: "#666", fontSize: 13 }}>Change: </span>
          <strong style={{ color: (latest.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828" }}>
            {latest.day_change_pct != null ? `${latest.day_change_pct >= 0 ? "+" : ""}${latest.day_change_pct.toFixed(2)}%` : "—"}
          </strong>
        </div>
        <div>
          <span style={{ color: "#666", fontSize: 13 }}>Volume: </span>
          <strong>{latest.volume?.toLocaleString() ?? "—"}</strong>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>Price History</h3>
        <PriceChart data={chartData} />
      </div>

      <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>Volume</h3>
        <VolumeChart data={chartData} />
      </div>

      <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>All Samples</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Time", "Type", "Price", "Volume", "Bid", "Ask", "Market Cap", "Change %"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #ddd", fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((s: any) => (
              <tr key={s.id}>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{new Date(s.timestamp).toLocaleString()}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.sample_type}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.price != null ? `$${s.price.toFixed(2)}` : "—"}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.volume?.toLocaleString() ?? "—"}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.bid != null ? `$${s.bid.toFixed(2)}` : "—"}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.ask != null ? `$${s.ask.toFixed(2)}` : "—"}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.market_cap != null ? `$${(s.market_cap / 1e9).toFixed(1)}B` : "—"}</td>
                <td style={{
                  padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13,
                  color: (s.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828",
                }}>
                  {s.day_change_pct != null ? `${s.day_change_pct >= 0 ? "+" : ""}${s.day_change_pct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Stock Detail page with price and volume charts"
```

---

## Task 16: Top Movers Page

**Files:**
- Create: `frontend/src/components/Sparkline.tsx`
- Modify: `frontend/src/pages/TopMovers.tsx`

- [ ] **Step 1: Create Sparkline component**

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data }: { data: (number | null)[] }) {
  const points = data
    .map((v, i) => ({ x: i, y: v }))
    .filter((p) => p.y != null);

  if (points.length < 2) return <span style={{ color: "#999" }}>—</span>;

  const first = points[0].y!;
  const last = points[points.length - 1].y!;
  const color = last >= first ? "#2e7d32" : "#c62828";

  return (
    <ResponsiveContainer width={80} height={30}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="y" stroke={color} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implement TopMovers page**

```tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Sparkline } from "../components/Sparkline";

type MoverType = "gainers" | "losers" | "active";

export function TopMovers() {
  const [type, setType] = useState<MoverType>("gainers");
  const [limit, setLimit] = useState(10);
  const [movers, setMovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.getTopMovers(type, limit).then((data) => {
      setMovers(data);
      setLoading(false);
    });
  }, [type, limit]);

  const btnStyle = (active: boolean) => ({
    padding: "6px 16px", border: "1px solid #ddd", borderRadius: 4,
    background: active ? "#1976d2" : "#fff", color: active ? "#fff" : "#333",
    cursor: "pointer", fontWeight: active ? 700 : 400,
  });

  const tdStyle = { padding: "8px 12px", borderBottom: "1px solid #eee" };

  return (
    <div>
      <h1>Top Movers</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button style={btnStyle(type === "gainers")} onClick={() => setType("gainers")}>Top Gainers</button>
        <button style={btnStyle(type === "losers")} onClick={() => setType("losers")}>Top Losers</button>
        <button style={btnStyle(type === "active")} onClick={() => setType("active")}>Most Active</button>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          style={{ padding: "6px 12px", marginLeft: 16, border: "1px solid #ddd", borderRadius: 4 }}>
          <option value={10}>Top 10</option>
          <option value={25}>Top 25</option>
          <option value={50}>Top 50</option>
        </select>
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>#</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Ticker</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Name</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Price</th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>
                {type === "active" ? "Volume" : "Change %"}
              </th>
              <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Intraday</th>
            </tr>
          </thead>
          <tbody>
            {movers.map((m, i) => (
              <tr key={m.ticker} onClick={() => navigate(`/stock/${m.ticker}`)}
                style={{ cursor: "pointer" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{m.ticker}</td>
                <td style={tdStyle}>{m.name}</td>
                <td style={tdStyle}>{m.price != null ? `$${m.price.toFixed(2)}` : "—"}</td>
                <td style={{
                  ...tdStyle, fontWeight: 600,
                  color: type === "active" ? "#333" : (m.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828",
                }}>
                  {type === "active"
                    ? (m.volume?.toLocaleString() ?? "—")
                    : (m.day_change_pct != null ? `${m.day_change_pct >= 0 ? "+" : ""}${m.day_change_pct.toFixed(2)}%` : "—")}
                </td>
                <td style={tdStyle}><Sparkline data={m.sparkline} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Top Movers page with sparkline charts and type/limit toggles"
```

---

## Task 17: Alerts Page

**Files:**
- Create: `frontend/src/components/AlertForm.tsx`
- Modify: `frontend/src/pages/Alerts.tsx`

- [ ] **Step 1: Create AlertForm component**

```tsx
import { useState, useEffect } from "react";
import { api } from "../api/client";

type Props = {
  stocks: any[];
  editAlert?: any;
  onSave: () => void;
  onCancel: () => void;
};

export function AlertForm({ stocks, editAlert, onSave, onCancel }: Props) {
  const [stockId, setStockId] = useState<string>(editAlert?.stock_id?.toString() ?? "");
  const [condition, setCondition] = useState(editAlert?.condition ?? "price_above");
  const [threshold, setThreshold] = useState(editAlert?.threshold?.toString() ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      stock_id: stockId ? Number(stockId) : undefined,
      condition,
      threshold: Number(threshold),
    };
    if (editAlert) {
      await api.updateAlert(editAlert.id, data);
    } else {
      await api.createAlert(data);
    }
    onSave();
  };

  const inputStyle = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, width: "100%" };

  return (
    <form onSubmit={handleSubmit} style={{
      background: "#fff", padding: 16, borderRadius: 8, marginBottom: 16,
      border: "1px solid #ddd",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Stock (blank = global)</label>
          <select value={stockId} onChange={(e) => setStockId(e.target.value)} style={inputStyle}>
            <option value="">All stocks (global)</option>
            {stocks.map((s: any) => (
              <option key={s.id} value={s.id}>{s.ticker} — {s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} style={inputStyle}>
            <option value="price_above">Price above</option>
            <option value="price_below">Price below</option>
            <option value="volume_spike">Volume spike above</option>
            <option value="change_pct">Change % exceeds</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Threshold</label>
          <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)}
            style={inputStyle} required />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{
          padding: "6px 16px", background: "#1976d2", color: "#fff",
          border: "none", borderRadius: 4, cursor: "pointer",
        }}>
          {editAlert ? "Update" : "Create"} Alert
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: "6px 16px", background: "#eee", border: "none", borderRadius: 4, cursor: "pointer",
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Implement Alerts page**

```tsx
import { useState, useEffect } from "react";
import { api } from "../api/client";
import { AlertForm } from "../components/AlertForm";

export function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAlert, setEditAlert] = useState<any>(null);

  const loadData = async () => {
    const [a, n, s] = await Promise.all([
      api.getAlerts(), api.getNotifications(), api.getStocks(),
    ]);
    setAlerts(a);
    setNotifications(n);
    setStocks(s);
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: number) => {
    await api.deleteAlert(id);
    loadData();
  };

  const handleToggle = async (alert: any) => {
    await api.updateAlert(alert.id, { enabled: !alert.enabled });
    loadData();
  };

  const tdStyle = { padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Alerts</h1>
        <button onClick={() => { setEditAlert(null); setShowForm(true); }} style={{
          padding: "8px 16px", background: "#1976d2", color: "#fff",
          border: "none", borderRadius: 4, cursor: "pointer",
        }}>
          + New Alert
        </button>
      </div>

      {showForm && (
        <AlertForm
          stocks={stocks}
          editAlert={editAlert}
          onSave={() => { setShowForm(false); setEditAlert(null); loadData(); }}
          onCancel={() => { setShowForm(false); setEditAlert(null); }}
        />
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, marginBottom: 32 }}>
        <thead>
          <tr>
            {["Stock", "Condition", "Threshold", "Enabled", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td style={tdStyle}>{a.ticker ?? "All stocks"}</td>
              <td style={tdStyle}>{a.condition.replace("_", " ")}</td>
              <td style={tdStyle}>{a.threshold}</td>
              <td style={tdStyle}>
                <button onClick={() => handleToggle(a)} style={{
                  background: a.enabled ? "#2e7d32" : "#999", color: "#fff",
                  border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12,
                }}>
                  {a.enabled ? "ON" : "OFF"}
                </button>
              </td>
              <td style={tdStyle}>
                <button onClick={() => { setEditAlert(a); setShowForm(true); }}
                  style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12, marginRight: 8 }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(a.id)}
                  style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No alerts configured</td></tr>
          )}
        </tbody>
      </table>

      <h2>Notification History</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
        <thead>
          <tr>
            {["Time", "Stock", "Message", "Status"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id} style={{ background: n.read ? "#fff" : "#e3f2fd" }}>
              <td style={tdStyle}>{new Date(n.triggered_at).toLocaleString()}</td>
              <td style={tdStyle}>{n.ticker ?? "—"}</td>
              <td style={tdStyle}>{n.message}</td>
              <td style={tdStyle}>
                {n.read ? "Read" : (
                  <button onClick={async () => { await api.markRead(n.id); loadData(); }}
                    style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12 }}>
                    Mark read
                  </button>
                )}
              </td>
            </tr>
          ))}
          {notifications.length === 0 && (
            <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>No notifications yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Alerts page with CRUD form and notification history"
```

---

## Task 18: Settings Page

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Implement Settings page**

```tsx
import { useState, useEffect } from "react";
import { api } from "../api/client";

export function Settings() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [sampleType, setSampleType] = useState("mid");
  const [triggerStatus, setTriggerStatus] = useState("");
  const [initStatus, setInitStatus] = useState("");
  const [exportTickers, setExportTickers] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const loadStocks = () => api.getStocks().then(setStocks);
  useEffect(() => { loadStocks(); }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createStock({ ticker, name, sector });
    setTicker(""); setName(""); setSector("");
    loadStocks();
  };

  const handleInitSp500 = async () => {
    setInitStatus("Loading S&P 500...");
    const result = await api.initSp500();
    setInitStatus(result.detail);
    loadStocks();
  };

  const handleTrigger = async () => {
    setTriggerStatus("Running...");
    const result = await api.triggerSample(sampleType);
    setTriggerStatus(result.detail);
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (exportTickers) params.tickers = exportTickers;
    if (exportStartDate) params.start_date = exportStartDate;
    if (exportEndDate) params.end_date = exportEndDate;
    window.open(api.exportCsvUrl(params), "_blank");
  };

  const handleDelete = async (id: number) => {
    await api.deleteStock(id);
    loadStocks();
  };

  const handleToggle = async (stock: any) => {
    await api.updateStock(stock.id, { active: !stock.active });
    loadStocks();
  };

  const sectionStyle = {
    background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };
  const inputStyle = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4 };
  const btnStyle = {
    padding: "6px 16px", background: "#1976d2", color: "#fff",
    border: "none", borderRadius: 4, cursor: "pointer",
  };

  return (
    <div>
      <h1>Settings</h1>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Initialize S&P 500</h3>
        <button onClick={handleInitSp500} style={btnStyle}>Load S&P 500 Stocks</button>
        {initStatus && <span style={{ marginLeft: 12, color: "#666" }}>{initStatus}</span>}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Add Custom Ticker</h3>
        <form onSubmit={handleAddStock} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)}
            style={inputStyle} required />
          <input placeholder="Company Name" value={name} onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }} required />
          <input placeholder="Sector" value={sector} onChange={(e) => setSector(e.target.value)}
            style={inputStyle} />
          <button type="submit" style={btnStyle}>Add</button>
        </form>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Manual Sample Trigger</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={inputStyle}>
            <option value="open">Open</option>
            <option value="mid">Midday</option>
            <option value="close">Close</option>
          </select>
          <button onClick={handleTrigger} style={btnStyle}>Run Sample Now</button>
          {triggerStatus && <span style={{ color: "#666" }}>{triggerStatus}</span>}
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Export CSV</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input placeholder="Tickers (comma-separated)" value={exportTickers}
            onChange={(e) => setExportTickers(e.target.value)} style={{ ...inputStyle, width: 200 }} />
          <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} style={inputStyle} />
          <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} style={inputStyle} />
          <button onClick={handleExport} style={btnStyle}>Download CSV</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Managed Stocks ({stocks.length})</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Ticker", "Name", "Sector", "Source", "Active", "Actions"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #ddd", fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stocks.slice(0, 50).map((s) => (
              <tr key={s.id}>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontWeight: 600, fontSize: 13 }}>{s.ticker}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.name}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.sector}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.source}</td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee" }}>
                  <button onClick={() => handleToggle(s)} style={{
                    background: s.active ? "#2e7d32" : "#999", color: "#fff",
                    border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12,
                  }}>
                    {s.active ? "ON" : "OFF"}
                  </button>
                </td>
                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee" }}>
                  {s.source === "custom" && (
                    <button onClick={() => handleDelete(s.id)}
                      style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stocks.length > 50 && <p style={{ color: "#666", fontSize: 13 }}>Showing first 50 of {stocks.length} stocks</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add Settings page with ticker management, trigger, and CSV export"
```

---

## Task 19: Final Integration & Smoke Test

**Files:**
- No new files

- [ ] **Step 1: Run all backend tests**

Run: `cd D:/Development/stock-trader && python -m pytest backend/tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Build frontend**

Run: `cd D:/Development/stock-trader/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Start backend server**

Run: `cd D:/Development/stock-trader && python -m uvicorn backend.main:app --reload`
Expected: Server starts on http://localhost:8000

- [ ] **Step 4: Verify API docs**

Open http://localhost:8000/docs in browser.
Expected: Swagger UI shows all endpoints.

- [ ] **Step 5: Start frontend dev server**

Run: `cd D:/Development/stock-trader/frontend && npm run dev`
Expected: Vite dev server starts on http://localhost:5173

- [ ] **Step 6: Smoke test the full flow**

1. Go to Settings → click "Load S&P 500 Stocks" → verify stocks appear
2. Go to Settings → click "Run Sample Now" → verify it completes
3. Go to Dashboard → verify stock table populated with latest data
4. Click a stock → verify detail page with charts
5. Go to Top Movers → toggle between gainers/losers/active
6. Go to Alerts → create an alert → verify it appears in list
7. Verify WebSocket connection indicator (check browser console for ws connection)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete stock sampler bot with dashboard, alerts, and top movers"
```
