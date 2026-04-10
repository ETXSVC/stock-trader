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
        stock = db.get(Stock, alert.stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
    db_alert = Alert(stock_id=alert.stock_id, condition=alert.condition, threshold=alert.threshold)
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
    alert = db.get(Alert, alert_id)
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
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"detail": "deleted"}
