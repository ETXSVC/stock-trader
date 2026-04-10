import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Sample
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(bind=_engine)


@pytest.fixture(autouse=True)
def setup_db():
    def override_get_db():
        db = _TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=_engine)
    db = _TestSession()
    stock = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    db.add(stock)
    db.commit()
    sample = Sample(stock_id=stock.id, sample_type="open", price=175.0, volume=50000000,
                    bid=174.9, ask=175.1, market_cap=2800000000000.0, day_change_pct=1.2)
    db.add(sample)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=_engine)
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def test_export_csv():
    resp = client.get("/api/export/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert len(lines) == 2
    assert "AAPL" in lines[1]
    assert "ticker" in lines[0]


def test_export_csv_filtered_by_ticker():
    resp = client.get("/api/export/csv", params={"tickers": "AAPL"})
    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    assert len(lines) == 2
