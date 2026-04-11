import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseUTC } from "../utils/time";

export function VolumeChart({ data }: { data: { timestamp: string; volume: number | null }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    time: parseUTC(d.timestamp).toLocaleDateString(),
    fullTime: parseUTC(d.timestamp).toLocaleString(),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime ?? ""}
          formatter={(val) => typeof val === "number" ? val.toLocaleString() : val}
        />
        <Bar dataKey="volume" fill="#42a5f5" />
      </BarChart>
    </ResponsiveContainer>
  );
}
