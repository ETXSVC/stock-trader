import { Link, Outlet, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/top-movers", label: "Top Movers" },
  { path: "/alerts", label: "Alerts" },
  { path: "/settings", label: "Settings" },
];

export function Layout() {
  const location = useLocation();
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56, background: "#1a1a2e", color: "#fff",
      }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Stock Sampler</span>
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} style={{
              color: location.pathname === item.path ? "#4fc3f7" : "#ccc",
              textDecoration: "none", fontSize: 14,
            }}>
              {item.label}
            </Link>
          ))}
        </div>
        <NotificationBell />
      </nav>
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
