import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { PriceChart } from "../components/PriceChart";
import { VolumeChart } from "../components/VolumeChart";
import { parseUTC } from "../utils/time";

export function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    api.getSamples({ ticker }).then((data) => { setSamples(data); setLoading(false); });
  }, [ticker]);

  if (loading) return <p>Loading...</p>;
  if (samples.length === 0) return <p>No data for {ticker}</p>;

  const latest = samples[0];
  const chartData = [...samples].reverse();
  const td = { padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 };

  return (
    <div>
      <Link to="/" style={{ color: "#1976d2", textDecoration: "none", fontSize: 14 }}>← Back</Link>
      <h1 style={{ margin: "8px 0" }}>{ticker} — {latest.name}</h1>
      <div style={{ display: "flex", gap: 24, marginBottom: 24, alignItems: "flex-end" }}>
        <div><span style={{ color: "#666", fontSize: 13 }}>Price: </span><strong>${latest.price?.toFixed(2) ?? "—"}</strong></div>
        <div><span style={{ color: "#666", fontSize: 13 }}>Change: </span>
          <strong style={{ color: (latest.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828" }}>
            {latest.day_change_pct != null ? `${latest.day_change_pct >= 0 ? "+" : ""}${latest.day_change_pct.toFixed(2)}%` : "—"}
          </strong>
        </div>
        <div><span style={{ color: "#666", fontSize: 13 }}>Volume: </span><strong>{latest.volume?.toLocaleString() ?? "—"}</strong></div>
        {latest.timestamp && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#666" }}>{parseUTC(latest.timestamp).toLocaleDateString()}</div>
            <div style={{ fontSize: 12, color: "#999" }}>{parseUTC(latest.timestamp).toLocaleTimeString()}</div>
          </div>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>Price History</h3>
        <PriceChart data={chartData} />
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>Volume</h3>
        <VolumeChart data={chartData} />
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0 }}>All Samples</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Time","Type","Price","Volume","Bid","Ask","Mkt Cap","Change %"].map(h => (
                <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {samples.map((s: any) => (
                <tr key={s.id}>
                  <td style={td}>
                    <div>{parseUTC(s.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{parseUTC(s.timestamp).toLocaleTimeString()}</div>
                  </td>
                  <td style={td}>{s.sample_type}</td>
                  <td style={td}>{s.price != null ? `$${s.price.toFixed(2)}` : "—"}</td>
                  <td style={td}>{s.volume?.toLocaleString() ?? "—"}</td>
                  <td style={td}>{s.bid != null ? `$${s.bid.toFixed(2)}` : "—"}</td>
                  <td style={td}>{s.ask != null ? `$${s.ask.toFixed(2)}` : "—"}</td>
                  <td style={td}>{s.market_cap != null ? `$${(s.market_cap/1e9).toFixed(1)}B` : "—"}</td>
                  <td style={{ ...td, color: (s.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828" }}>
                    {s.day_change_pct != null ? `${s.day_change_pct >= 0 ? "+" : ""}${s.day_change_pct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
