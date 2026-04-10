import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from backend.models import Stock, Alert, Notification
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
    alert = Alert(stock_id=stock.id, condition="price_above", threshold=200.0)
    db.add(alert)
    db.commit()
    notification = Notification(alert_id=alert.id, stock_id=stock.id, message="AAPL exceeded $200.00")
    db.add(notification)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=_engine)
    app.dependency_overrides.pop(get_db, None)


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
    client.put("/api/notifications/read-all")
    resp = client.get("/api/notifications")
    assert all(n["read"] for n in resp.json())
