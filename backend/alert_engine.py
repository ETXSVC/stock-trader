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
