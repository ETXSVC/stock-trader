import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseUTC } from "../utils/time";

export function VolumeChart({ data }: { data: { timestamp: string; volume: number | null }[] }) {
  const formatted = data.map((d) => {
    const dt = parseUTC(d.timestamp);
    return {
      ...d,
      time: dt.toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      fullTime: dt.toLocaleString(),
    };
  });
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
