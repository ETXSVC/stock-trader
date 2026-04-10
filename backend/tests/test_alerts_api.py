import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock
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
    db.add(Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500"))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=_engine)
    app.dependency_overrides.pop(get_db, None)


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
