import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Sparkline } from "../components/Sparkline";

type MoverType = "gainers" | "losers" | "active";

export function TopMovers() {
  const [type, setType] = useState<MoverType>("gainers");
  const [limit, setLimit] = useState(10);
  const [movers, setMovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.getTopMovers(type, limit).then((data) => { setMovers(data); setLoading(false); });
  }, [type, limit]);

  const btn = (label: string, val: MoverType) => (
    <button onClick={() => setType(val)} style={{
      padding: "6px 16px", border: "1px solid #ddd", borderRadius: 4,
      background: type === val ? "#1976d2" : "#fff",
      color: type === val ? "#fff" : "#333", cursor: "pointer", fontWeight: type === val ? 700 : 400,
    }}>{label}</button>
  );

  const td = { padding: "8px 12px", borderBottom: "1px solid #eee" };

  return (
    <div>
      <h1>Top Movers</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        {btn("Top Gainers", "gainers")}
        {btn("Top Losers", "losers")}
        {btn("Most Active", "active")}
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          style={{ padding: "6px 12px", marginLeft: 16, border: "1px solid #ddd", borderRadius: 4 }}>
          <option value={10}>Top 10</option>
          <option value={25}>Top 25</option>
          <option value={50}>Top 50</option>
        </select>
      </div>
      {loading ? <p>Loading...</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
          <thead>
            <tr>
              {["#","Ticker","Name","Price", type === "active" ? "Volume" : "Change %","Intraday"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movers.map((m, i) => (
              <tr key={m.ticker} onClick={() => navigate(`/stock/${m.ticker}`)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{m.ticker}</td>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.price != null ? `$${m.price.toFixed(2)}` : "—"}</td>
                <td style={{ ...td, fontWeight: 600, color: type === "active" ? "#333" : (m.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828" }}>
                  {type === "active"
                    ? (m.volume?.toLocaleString() ?? "—")
                    : (m.day_change_pct != null ? `${m.day_change_pct >= 0 ? "+" : ""}${m.day_change_pct.toFixed(2)}%` : "—")}
                </td>
                <td style={td}><Sparkline data={m.sparkline} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
