from backend.alert_engine import evaluate_alerts
from backend.models import Stock, Sample, Alert


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
