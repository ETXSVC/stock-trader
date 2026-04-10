import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Sample
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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
    assert len(resp.json()) >= 2


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
