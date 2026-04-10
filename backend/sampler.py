import time
import yfinance as yf
import pandas as pd
import logging
from sqlalchemy.orm import Session
from backend.models import Stock, Sample

logger = logging.getLogger(__name__)
BATCH_SIZE = 50
BATCH_DELAY = 2.0  # seconds between batches


def run_sample(db: Session, sample_type: str) -> list[Sample]:
    stocks = db.query(Stock).filter(Stock.active == True).all()
    if not stocks:
        logger.warning("No active stocks to sample")
        return []

    ticker_to_stock = {s.ticker: s for s in stocks}
    tickers = list(ticker_to_stock.keys())
    all_samples = []
    failed_tickers = []

    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i : i + BATCH_SIZE]
        batch_samples, batch_failed = _fetch_batch(db, batch, ticker_to_stock, sample_type)
        all_samples.extend(batch_samples)
        failed_tickers.extend(batch_failed)
        db.commit()
        if i + BATCH_SIZE < len(tickers):
            time.sleep(BATCH_DELAY)

    if failed_tickers:
        logger.info(f"Retrying {len(failed_tickers)} failed tickers")
        time.sleep(BATCH_DELAY)
        retry_samples, _ = _fetch_batch(db, failed_tickers, ticker_to_stock, sample_type)
        all_samples.extend(retry_samples)
        db.commit()

    return all_samples


def _fetch_batch(
    db: Session, tickers: list[str], ticker_to_stock: dict, sample_type: str
) -> tuple[list[Sample], list[str]]:
    try:
        raw = yf.download(
            tickers,
            period="2d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            group_by="ticker",
        )
    except Exception as e:
        logger.error(f"yf.download batch failed: {e}")
        return [], tickers

    samples = []
    failed = []

    for ticker in tickers:
        try:
            # Single-ticker download returns a flat DataFrame; multi-ticker uses MultiIndex
            if len(tickers) == 1:
                df = raw
            else:
                df = raw[ticker] if ticker in raw.columns.get_level_values(0) else None

            if df is None or df.empty:
                failed.append(ticker)
                continue

            # Drop rows where Close is NaN
            df = df.dropna(subset=["Close"])
            if df.empty:
                failed.append(ticker)
                continue

            latest = df.iloc[-1]
            price = float(latest["Close"])
            volume = int(latest["Volume"]) if not pd.isna(latest["Volume"]) else None

            day_change_pct = None
            if len(df) >= 2:
                prev_close = float(df.iloc[-2]["Close"])
                if prev_close:
                    day_change_pct = round(((price - prev_close) / prev_close) * 100, 4)

            stock = ticker_to_stock[ticker]
            sample = Sample(
                stock_id=stock.id,
                sample_type=sample_type,
                price=price,
                volume=volume,
                bid=None,
                ask=None,
                market_cap=None,
                day_change_pct=day_change_pct,
            )
            db.add(sample)
            samples.append(sample)
        except Exception as e:
            logger.error(f"Failed to process {ticker}: {e}")
            failed.append(ticker)

    return samples, failed
