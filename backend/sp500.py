import pandas as pd

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"


def fetch_sp500_tickers() -> list[dict]:
    tables = pd.read_html(SP500_URL)
    df = tables[0]
    tickers = []
    for _, row in df.iterrows():
        ticker = row["Symbol"].replace(".", "-")
        tickers.append({
            "ticker": ticker,
            "name": row["Security"],
            "sector": row["GICS Sector"],
        })
    return tickers
