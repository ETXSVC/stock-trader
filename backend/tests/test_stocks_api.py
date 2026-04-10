import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
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
    yield
    Base.metadata.drop_all(bind=_engine)
    app.dependency_overrides.pop(get_db, None)


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
    client.delete(f"/api/stocks/{stock_id}")
    resp = client.get("/api/stocks")
    assert len(resp.json()) == 0


def test_duplicate_ticker_rejected():
    client.post("/api/stocks", json={"ticker": "AAPL", "name": "Apple"})
    resp = client.post("/api/stocks", json={"ticker": "AAPL", "name": "Apple Again"})
    assert resp.status_code == 400
