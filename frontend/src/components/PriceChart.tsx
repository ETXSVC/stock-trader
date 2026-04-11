import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function PriceChart({ data }: { data: { timestamp: string; price: number | null }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleDateString(),
    fullTime: new Date(d.timestamp).toLocaleString(),
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime ?? ""}
          formatter={(val) => typeof val === "number" ? `$${val.toFixed(2)}` : val}
        />
        <Line type="monotone" dataKey="price" stroke="#1976d2" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
