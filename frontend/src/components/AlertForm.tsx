import { useState } from "react";
import { api } from "../api/client";

type Props = { stocks: any[]; editAlert?: any; onSave: () => void; onCancel: () => void };

export function AlertForm({ stocks, editAlert, onSave, onCancel }: Props) {
  const [stockId, setStockId] = useState<string>(editAlert?.stock_id?.toString() ?? "");
  const [condition, setCondition] = useState(editAlert?.condition ?? "price_above");
  const [threshold, setThreshold] = useState(editAlert?.threshold?.toString() ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { stock_id: stockId ? Number(stockId) : undefined, condition, threshold: Number(threshold) };
    if (editAlert) await api.updateAlert(editAlert.id, data);
    else await api.createAlert(data);
    onSave();
  };

  const inp = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, width: "100%" };

  return (
    <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid #ddd" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Stock (blank = global)</label>
          <select value={stockId} onChange={(e) => setStockId(e.target.value)} style={inp}>
            <option value="">All stocks (global)</option>
            {stocks.map((s: any) => <option key={s.id} value={s.id}>{s.ticker} — {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} style={inp}>
            <option value="price_above">Price above</option>
            <option value="price_below">Price below</option>
            <option value="volume_spike">Volume spike above</option>
            <option value="change_pct">Change % exceeds</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Threshold</label>
          <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={inp} required />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{ padding: "6px 16px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {editAlert ? "Update" : "Create"} Alert
        </button>
        <button type="button" onClick={onCancel} style={{ padding: "6px 16px", background: "#eee", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
