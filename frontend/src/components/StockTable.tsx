import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type Sample = {
  ticker: string; name: string; price: number | null;
  volume: number | null; day_change_pct: number | null;
  sample_type: string; timestamp: string;
};
type SortKey = "ticker" | "price" | "volume" | "day_change_pct";

export function StockTable({ samples }: { samples: Sample[] }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    let data = [...samples];
    if (filter) {
      const f = filter.toUpperCase();
      data = data.filter((s) => s.ticker.includes(f) || s.name.toUpperCase().includes(f));
    }
    data.sort((a, b) => {
      const aVal = a[sortKey] ?? (typeof a[sortKey] === "string" ? "" : 0);
      const bVal = b[sortKey] ?? (typeof b[sortKey] === "string" ? "" : 0);
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return data;
  }, [samples, sortKey, sortAsc, filter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const th = (label: string, key?: SortKey) => (
    <th onClick={() => key && toggleSort(key)} style={{
      cursor: key ? "pointer" : "default", padding: "8px 12px",
      textAlign: "left", borderBottom: "2px solid #ddd", background: "#fafafa",
      userSelect: "none", whiteSpace: "nowrap",
    }}>
      {label}{key && sortKey === key ? (sortAsc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div>
      <input type="text" placeholder="Filter by ticker or name..."
        value={filter} onChange={(e) => setFilter(e.target.value)}
        style={{ padding: "8px 12px", marginBottom: 12, width: 300, border: "1px solid #ddd", borderRadius: 4 }}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
          <thead>
            <tr>
              {th("Ticker", "ticker")}{th("Name")}
              {th("Price", "price")}{th("Volume", "volume")}
              {th("Change %", "day_change_pct")}{th("Type")}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.ticker} onClick={() => navigate(`/stock/${s.ticker}`)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 600 }}>{s.ticker}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>{s.name}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>{s.price != null ? `$${s.price.toFixed(2)}` : "—"}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>{s.volume != null ? s.volume.toLocaleString() : "—"}</td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontWeight: 600, color: (s.day_change_pct ?? 0) >= 0 ? "#2e7d32" : "#c62828" }}>
                  {s.day_change_pct != null ? `${s.day_change_pct >= 0 ? "+" : ""}${s.day_change_pct.toFixed(2)}%` : "—"}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>{s.sample_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
