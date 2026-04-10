from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Stock
from backend.schemas import StockCreate, StockUpdate, StockResponse
from backend.sp500 import fetch_sp500_tickers

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("", response_model=list[StockResponse])
def list_stocks(source: str = None, active: bool = None, db: Session = Depends(get_db)):
    query = db.query(Stock)
    if source:
        query = query.filter(Stock.source == source)
    if active is not None:
        query = query.filter(Stock.active == active)
    return query.order_by(Stock.ticker).all()


@router.post("", response_model=StockResponse)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    existing = db.query(Stock).filter(Stock.ticker == stock.ticker.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ticker {stock.ticker} already exists")
    db_stock = Stock(
        ticker=stock.ticker.upper(),
        name=stock.name,
        sector=stock.sector,
        source="custom",
    )
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock


@router.put("/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, update: StockUpdate, db: Session = Depends(get_db)):
    stock = db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(stock, field, value)
    db.commit()
    db.refresh(stock)
    return stock


@router.delete("/{stock_id}")
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    db.delete(stock)
    db.commit()
    return {"detail": "deleted"}


@router.post("/init-sp500")
def init_sp500(db: Session = Depends(get_db)):
    tickers = fetch_sp500_tickers()
    added = 0
    for t in tickers:
        existing = db.query(Stock).filter(Stock.ticker == t["ticker"]).first()
        if not existing:
            db.add(Stock(ticker=t["ticker"], name=t["name"], sector=t["sector"], source="sp500"))
            added += 1
    db.commit()
    return {"detail": f"Added {added} S&P 500 stocks"}
