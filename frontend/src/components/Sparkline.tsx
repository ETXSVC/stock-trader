import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data }: { data: (number | null)[] }) {
  const points = data.map((v, i) => ({ x: i, y: v })).filter((p) => p.y != null);
  if (points.length < 2) return <span style={{ color: "#999" }}>—</span>;
  const color = (points[points.length - 1].y ?? 0) >= (points[0].y ?? 0) ? "#2e7d32" : "#c62828";
  return (
    <ResponsiveContainer width={80} height={30}>
      <LineChart data={points}>
        <Line type="monotone" dataKey="y" stroke={color} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
