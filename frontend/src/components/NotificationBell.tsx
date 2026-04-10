import { useState, useEffect } from "react";
import { api } from "../api/client";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api.getNotifications().then(setNotifications).catch(() => {});
  }, []);

  const handleMarkAllRead = async () => {
    await api.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        background: "none", border: "none", color: "#fff",
        cursor: "pointer", fontSize: 18, position: "relative",
      }}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -8, background: "#e53935",
            borderRadius: "50%", padding: "2px 6px", fontSize: 10, color: "#fff",
          }}>
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 36, background: "#fff",
          border: "1px solid #ddd", borderRadius: 8, width: 320,
          maxHeight: 400, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 100,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #eee" }}>
            <strong>Notifications</strong>
            <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12 }}>
              Mark all read
            </button>
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: 16, color: "#999", textAlign: "center" }}>No notifications</div>
          )}
          {notifications.map((n) => (
            <div key={n.id} style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", background: n.read ? "#fff" : "#e3f2fd" }}>
              <div style={{ fontSize: 13 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{new Date(n.triggered_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
