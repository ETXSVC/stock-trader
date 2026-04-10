import { useState, useEffect } from "react";
import { api } from "../api/client";
import { AlertForm } from "../components/AlertForm";

export function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAlert, setEditAlert] = useState<any>(null);

  const loadData = async () => {
    const [a, n, s] = await Promise.all([api.getAlerts(), api.getNotifications(), api.getStocks()]);
    setAlerts(a); setNotifications(n); setStocks(s);
  };

  useEffect(() => { loadData(); }, []);

  const td = { padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Alerts</h1>
        <button onClick={() => { setEditAlert(null); setShowForm(true); }}
          style={{ padding: "8px 16px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          + New Alert
        </button>
      </div>
      {showForm && (
        <AlertForm stocks={stocks} editAlert={editAlert}
          onSave={() => { setShowForm(false); setEditAlert(null); loadData(); }}
          onCancel={() => { setShowForm(false); setEditAlert(null); }} />
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, marginBottom: 32 }}>
        <thead>
          <tr>{["Stock","Condition","Threshold","Enabled","Actions"].map(h => (
            <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td style={td}>{a.ticker ?? "All stocks"}</td>
              <td style={td}>{a.condition.replace(/_/g, " ")}</td>
              <td style={td}>{a.threshold}</td>
              <td style={td}>
                <button onClick={async () => { await api.updateAlert(a.id, { enabled: !a.enabled }); loadData(); }}
                  style={{ background: a.enabled ? "#2e7d32" : "#999", color: "#fff", border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12 }}>
                  {a.enabled ? "ON" : "OFF"}
                </button>
              </td>
              <td style={td}>
                <button onClick={() => { setEditAlert(a); setShowForm(true); }}
                  style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12, marginRight: 8 }}>Edit</button>
                <button onClick={async () => { await api.deleteAlert(a.id); loadData(); }}
                  style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>Delete</button>
              </td>
            </tr>
          ))}
          {alerts.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#999" }}>No alerts configured</td></tr>}
        </tbody>
      </table>
      <h2>Notification History</h2>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={async () => { await api.markAllRead(); loadData(); }}
          style={{ padding: "6px 12px", background: "#eee", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
          Mark all read
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8 }}>
        <thead>
          <tr>{["Time","Stock","Message","Status"].map(h => (
            <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id} style={{ background: n.read ? "#fff" : "#e3f2fd" }}>
              <td style={td}>{new Date(n.triggered_at).toLocaleString()}</td>
              <td style={td}>{n.ticker ?? "—"}</td>
              <td style={td}>{n.message}</td>
              <td style={td}>{n.read ? "Read" : (
                <button onClick={async () => { await api.markRead(n.id); loadData(); }}
                  style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12 }}>Mark read</button>
              )}</td>
            </tr>
          ))}
          {notifications.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#999" }}>No notifications yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
