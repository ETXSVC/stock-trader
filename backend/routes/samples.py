from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from datetime import datetime, timezone
from backend.database import get_db
from backend.models import Stock, Sample
from backend.schemas import SampleWithTicker, TopMoverResponse, TriggerRequest
from backend.sampler import run_sample
from backend.alert_engine import evaluate_alerts
from backend.websocket_manager import ws_manager

router = APIRouter(prefix="/api/samples", tags=["samples"])


@router.get("", response_model=list[SampleWithTicker])
def list_samples(
    ticker: str = None,
    sample_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Sample).join(Stock)
    if ticker:
        query = query.filter(Stock.ticker == ticker.upper())
    if sample_type:
        query = query.filter(Sample.sample_type == sample_type)
    if start_date:
        query = query.filter(Sample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Sample.timestamp <= datetime.fromisoformat(end_date))

    rows = query.order_by(desc(Sample.timestamp)).limit(1000).all()
    return [
        SampleWithTicker(
            id=s.id, stock_id=s.stock_id, sample_type=s.sample_type,
            timestamp=s.timestamp, price=s.price, volume=s.volume,
            bid=s.bid, ask=s.ask, market_cap=s.market_cap,
            day_change_pct=s.day_change_pct,
            ticker=s.stock.ticker, name=s.stock.name,
        )
        for s in rows
    ]


@router.get("/latest", response_model=list[SampleWithTicker])
def latest_samples(db: Session = Depends(get_db)):
    subq = (
        db.query(Sample.stock_id, func.max(Sample.id).label("max_id"))
        .group_by(Sample.stock_id)
        .subquery()
    )
    rows = (
        db.query(Sample)
        .join(subq, Sample.id == subq.c.max_id)
        .join(Stock)
        .order_by(Stock.ticker)
        .all()
    )
    return [
        SampleWithTicker(
            id=s.id, stock_id=s.stock_id, sample_type=s.sample_type,
            timestamp=s.timestamp, price=s.price, volume=s.volume,
            bid=s.bid, ask=s.ask, market_cap=s.market_cap,
            day_change_pct=s.day_change_pct,
            ticker=s.stock.ticker, name=s.stock.name,
        )
        for s in rows
    ]


@router.get("/top-movers", response_model=list[TopMoverResponse])
def top_movers(type: str = "gainers", limit: int = 10, db: Session = Depends(get_db)):
    subq = (
        db.query(Sample.stock_id, func.max(Sample.id).label("max_id"))
        .group_by(Sample.stock_id)
        .subquery()
    )
    query = db.query(Sample).join(subq, Sample.id == subq.c.max_id).join(Stock)

    if type == "gainers":
        query = query.filter(Sample.day_change_pct != None).order_by(desc(Sample.day_change_pct))
    elif type == "losers":
        query = query.filter(Sample.day_change_pct != None).order_by(asc(Sample.day_change_pct))
    elif type == "active":
        query = query.filter(Sample.volume != None).order_by(desc(Sample.volume))
    else:
        raise HTTPException(status_code=400, detail="type must be gainers, losers, or active")

    rows = query.limit(limit).all()
    results = []
    for s in rows:
        today_samples = (
            db.query(Sample)
            .filter(Sample.stock_id == s.stock_id)
            .filter(Sample.sample_type.in_(["open", "mid", "close"]))
            .order_by(desc(Sample.timestamp))
            .limit(3)
            .all()
        )
        sparkline_map = {ts.sample_type: ts.price for ts in today_samples}
        sparkline = [sparkline_map.get("open"), sparkline_map.get("mid"), sparkline_map.get("close")]
        results.append(TopMoverResponse(
            ticker=s.stock.ticker, name=s.stock.name,
            price=s.price, volume=s.volume,
            day_change_pct=s.day_change_pct, sparkline=sparkline,
        ))
    return results


@router.post("/trigger")
async def trigger_sample(req: TriggerRequest, db: Session = Depends(get_db)):
    samples = run_sample(db, req.sample_type)
    notifications = evaluate_alerts(db, samples)
    await ws_manager.broadcast("sample_complete", {
        "sample_type": req.sample_type,
        "count": len(samples),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    for n in notifications:
        await ws_manager.broadcast("alert_triggered", {
            "message": n.message,
            "stock_id": n.stock_id,
            "triggered_at": n.triggered_at.isoformat() if n.triggered_at else None,
        })
    return {"detail": f"Sampled {len(samples)} stocks, {len(notifications)} alerts triggered"}
