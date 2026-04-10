from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from backend.database import get_db
from backend.models import Sample, Stock
import csv
import io

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/csv")
def export_csv(
    tickers: str = None,
    sample_type: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Sample).join(Stock)
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",")]
        query = query.filter(Stock.ticker.in_(ticker_list))
    if sample_type:
        query = query.filter(Sample.sample_type == sample_type)
    if start_date:
        query = query.filter(Sample.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Sample.timestamp <= datetime.fromisoformat(end_date))

    rows = query.order_by(Sample.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ticker", "name", "sample_type", "timestamp", "price", "volume",
                     "bid", "ask", "market_cap", "day_change_pct"])
    for s in rows:
        writer.writerow([
            s.stock.ticker, s.stock.name, s.sample_type,
            s.timestamp.isoformat() if s.timestamp else "",
            s.price, s.volume, s.bid, s.ask, s.market_cap, s.day_change_pct,
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_samples.csv"},
    )
