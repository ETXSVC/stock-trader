from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Notification
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
    n = db.get(Notification, notification_id)
    if not n:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
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
