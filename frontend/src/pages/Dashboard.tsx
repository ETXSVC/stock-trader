import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { StockTable } from "../components/StockTable";
import { useWebSocket } from "../hooks/useWebSocket";
import { useBrowserNotifications } from "../hooks/useNotifications";

export function Dashboard() {
  const [samples, setSamples] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, lastSample: "Never", alertCount: 0 });
  const [loading, setLoading] = useState(true);
  const { permission, requestPermission, showNotification } = useBrowserNotifications();

  const loadData = useCallback(async () => {
    try {
      const [latest, alerts] = await Promise.all([api.getLatestSamples(), api.getAlerts()]);
      setSamples(latest);
      setStats({
        total: latest.length,
        lastSample: latest[0]?.timestamp ? new Date(latest[0].timestamp).toLocaleString() : "Never",
        alertCount: alerts.filter((a: any) => a.enabled).length,
      });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onWsMessage = useCallback((msg: { event: string; data: any }) => {
    if (msg.event === "sample_complete") loadData();
    if (msg.event === "alert_triggered") showNotification("Stock Alert", msg.data.message);
  }, [loadData, showNotification]);

  useWebSocket(onWsMessage);

  const card = (label: string, value: string | number) => (
    <div style={{ background: "#fff", borderRadius: 8, padding: "16px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", flex: 1 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        {permission !== "granted" && (
          <button onClick={requestPermission} style={{ padding: "8px 16px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Enable Notifications
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {card("Total Stocks", stats.total)}
        {card("Last Sample", stats.lastSample)}
        {card("Active Alerts", stats.alertCount)}
      </div>
      {loading ? <p>Loading...</p> : <StockTable samples={samples} />}
    </div>
  );
}
