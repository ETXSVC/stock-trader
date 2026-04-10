import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function VolumeChart({ data }: { data: { timestamp: string; volume: number | null }[] }) {
  const formatted = data.map((d) => ({ ...d, time: new Date(d.timestamp).toLocaleDateString() }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip formatter={(val) => typeof val === "number" ? val.toLocaleString() : val} />
        <Bar dataKey="volume" fill="#42a5f5" />
      </BarChart>
    </ResponsiveContainer>
  );
}
