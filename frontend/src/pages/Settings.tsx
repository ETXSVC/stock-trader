import { useState, useEffect } from "react";
import { api } from "../api/client";

export function Settings() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [sampleType, setSampleType] = useState("mid");
  const [triggerStatus, setTriggerStatus] = useState("");
  const [initStatus, setInitStatus] = useState("");
  const [exportTickers, setExportTickers] = useState("");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  const loadStocks = () => api.getStocks().then(setStocks).catch(() => {});
  useEffect(() => { loadStocks(); }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createStock({ ticker, name, sector });
    setTicker(""); setName(""); setSector("");
    loadStocks();
  };

  const section = { background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" };
  const inp = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4 };
  const btn = { padding: "6px 16px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" };
  const td = { padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 };

  return (
    <div>
      <h1>Settings</h1>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Initialize S&P 500</h3>
        <button style={btn} onClick={async () => { setInitStatus("Loading..."); const r = await api.initSp500(); setInitStatus(r.detail); loadStocks(); }}>
          Load S&P 500 Stocks
        </button>
        {initStatus && <span style={{ marginLeft: 12, color: "#666" }}>{initStatus}</span>}
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Add Custom Ticker</h3>
        <form onSubmit={handleAddStock} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} style={inp} required />
          <input placeholder="Company Name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, flex: 1 }} required />
          <input placeholder="Sector" value={sector} onChange={(e) => setSector(e.target.value)} style={inp} />
          <button type="submit" style={btn}>Add</button>
        </form>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Manual Sample Trigger</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={inp}>
            <option value="open">Open</option>
            <option value="mid">Midday</option>
            <option value="close">Close</option>
          </select>
          <button style={btn} onClick={async () => { setTriggerStatus("Running..."); const r = await api.triggerSample(sampleType); setTriggerStatus(r.detail); }}>
            Run Sample Now
          </button>
          {triggerStatus && <span style={{ color: "#666" }}>{triggerStatus}</span>}
        </div>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Export CSV</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Tickers (comma-separated)" value={exportTickers} onChange={(e) => setExportTickers(e.target.value)} style={{ ...inp, width: 200 }} />
          <input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)} style={inp} />
          <input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} style={inp} />
          <button style={btn} onClick={() => {
            const params: Record<string, string> = {};
            if (exportTickers) params.tickers = exportTickers;
            if (exportStart) params.start_date = exportStart;
            if (exportEnd) params.end_date = exportEnd;
            window.open(api.exportCsvUrl(params), "_blank");
          }}>Download CSV</button>
        </div>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Managed Stocks ({stocks.length})</h3>
        <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Ticker","Name","Sector","Source","Active","Actions"].map(h => (
                <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600, background: "#fafafa" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.ticker}</td>
                  <td style={td}>{s.name}</td>
                  <td style={td}>{s.sector}</td>
                  <td style={td}>{s.source}</td>
                  <td style={td}>
                    <button onClick={async () => { await api.updateStock(s.id, { active: !s.active }); loadStocks(); }}
                      style={{ background: s.active ? "#2e7d32" : "#999", color: "#fff", border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12 }}>
                      {s.active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td style={td}>
                    {s.source === "custom" && (
                      <button onClick={async () => { await api.deleteStock(s.id); loadStocks(); }}
                        style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>Delete</button>
                    )}
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
