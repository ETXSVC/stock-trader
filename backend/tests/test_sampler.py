from unittest.mock import patch, MagicMock
from backend.models import Stock
from backend.sampler import run_sample


def test_run_sample_creates_sample_records(db_session):
    stock1 = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500")
    stock2 = Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500")
    db_session.add_all([stock1, stock2])
    db_session.commit()

    mock_ticker_aapl = MagicMock()
    mock_ticker_aapl.info = {
        "currentPrice": 175.0, "volume": 50000000, "bid": 174.9,
        "ask": 175.1, "marketCap": 2800000000000, "regularMarketChangePercent": 1.2,
    }
    mock_ticker_msft = MagicMock()
    mock_ticker_msft.info = {
        "currentPrice": 420.0, "volume": 30000000, "bid": 419.8,
        "ask": 420.2, "marketCap": 3100000000000, "regularMarketChangePercent": -0.5,
    }
    mock_tickers = MagicMock()
    mock_tickers.tickers = {"AAPL": mock_ticker_aapl, "MSFT": mock_ticker_msft}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "open")

    assert len(samples) == 2
    prices = {s.stock.ticker: s.price for s in samples}
    assert prices["AAPL"] == 175.0
    assert prices["MSFT"] == 420.0


def test_run_sample_skips_inactive_stocks(db_session):
    active = Stock(ticker="AAPL", name="Apple", sector="Tech", source="sp500", active=True)
    inactive = Stock(ticker="MSFT", name="Microsoft", sector="Tech", source="sp500", active=False)
    db_session.add_all([active, inactive])
    db_session.commit()

    mock_ticker = MagicMock()
    mock_ticker.info = {
        "currentPrice": 175.0, "volume": 50000000, "bid": 174.9,
        "ask": 175.1, "marketCap": 2800000000000, "regularMarketChangePercent": 1.2,
    }
    mock_tickers = MagicMock()
    mock_tickers.tickers = {"AAPL": mock_ticker}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "open")

    assert len(samples) == 1
    assert samples[0].stock.ticker == "AAPL"


def test_run_sample_handles_failed_ticker(db_session):
    stock = Stock(ticker="BADTICKER", name="Bad", sector="N/A", source="custom")
    db_session.add(stock)
    db_session.commit()

    mock_ticker = MagicMock()
    mock_ticker.info = {}
    mock_tickers = MagicMock()
    mock_tickers.tickers = {"BADTICKER": mock_ticker}

    with patch("yfinance.Tickers", return_value=mock_tickers):
        samples = run_sample(db_session, "mid")

    assert len(samples) == 0
