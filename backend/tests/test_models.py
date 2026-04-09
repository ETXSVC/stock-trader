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
