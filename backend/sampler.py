import yfinance as yf
import logging
from sqlalchemy.orm import Session
from backend.models import Stock, Sample

logger = logging.getLogger(__name__)
BATCH_SIZE = 50


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

    if failed_tickers:
        logger.info(f"Retrying {len(failed_tickers)} failed tickers")
        retry_samples, _ = _fetch_batch(db, failed_tickers, ticker_to_stock, sample_type)
        all_samples.extend(retry_samples)

    db.commit()
    return all_samples


def _fetch_batch(
    db: Session, tickers: list[str], ticker_to_stock: dict, sample_type: str
) -> tuple[list[Sample], list[str]]:
    samples = []
    failed = []

    try:
        yf_tickers = yf.Tickers(" ".join(tickers))
    except Exception as e:
        logger.error(f"yfinance batch fetch failed: {e}")
        return [], tickers

    for ticker in tickers:
        try:
            yf_ticker = yf_tickers.tickers.get(ticker)
            if yf_ticker is None:
                failed.append(ticker)
                continue

            info = yf_ticker.info
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            if price is None:
                failed.append(ticker)
                continue

            stock = ticker_to_stock[ticker]
            sample = Sample(
                stock_id=stock.id,
                sample_type=sample_type,
                price=price,
                volume=info.get("volume") or info.get("regularMarketVolume"),
                bid=info.get("bid"),
                ask=info.get("ask"),
                market_cap=info.get("marketCap"),
                day_change_pct=info.get("regularMarketChangePercent"),
            )
            db.add(sample)
            samples.append(sample)
        except Exception as e:
            logger.error(f"Failed to process {ticker}: {e}")
            failed.append(ticker)

    return samples, failed
