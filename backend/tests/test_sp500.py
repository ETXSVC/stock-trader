from unittest.mock import patch
import pandas as pd
from backend.sp500 import fetch_sp500_tickers


def test_fetch_sp500_tickers_parses_wikipedia():
    mock_df = pd.DataFrame({
        "Symbol": ["AAPL", "MSFT", "GOOG"],
        "Security": ["Apple Inc.", "Microsoft Corp.", "Alphabet Inc."],
        "GICS Sector": ["Technology", "Technology", "Communication"],
    })

    with patch("pandas.read_html", return_value=[mock_df]):
        result = fetch_sp500_tickers()

    assert len(result) == 3
    assert result[0] == {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology"}
    assert result[2]["ticker"] == "GOOG"


def test_fetch_sp500_cleans_dot_tickers():
    mock_df = pd.DataFrame({
        "Symbol": ["BRK.B", "BF.B"],
        "Security": ["Berkshire Hathaway", "Brown-Forman"],
        "GICS Sector": ["Financials", "Consumer Staples"],
    })

    with patch("pandas.read_html", return_value=[mock_df]):
        result = fetch_sp500_tickers()

    assert result[0]["ticker"] == "BRK-B"
    assert result[1]["ticker"] == "BF-B"
