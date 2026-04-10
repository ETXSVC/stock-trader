import io
import pandas as pd
import httpx

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; stock-sampler-bot/1.0)"}


def fetch_sp500_tickers() -> list[dict]:
    response = httpx.get(SP500_URL, headers=_HEADERS, follow_redirects=True, timeout=30)
    response.raise_for_status()
    tables = pd.read_html(io.StringIO(response.text))
    df = tables[0]
    tickers = []
    for _, row in df.iterrows():
        ticker = str(row["Symbol"]).replace(".", "-")
        tickers.append({
            "ticker": ticker,
            "name": row["Security"],
            "sector": row["GICS Sector"],
        })
    return tickers
