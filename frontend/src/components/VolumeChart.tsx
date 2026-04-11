import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { parseUTC } from "../utils/time";

function StackedTick({ x, y, payload }: any) {
  const [date, time] = (payload.value as string).split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#666" fontSize={11}>{date}</text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#999" fontSize={10}>{time}</text>
    </g>
  );
}

export function VolumeChart({ data }: { data: { timestamp: string; volume: number | null }[] }) {
  const formatted = data.map((d) => {
    const dt = parseUTC(d.timestamp);
    const date = dt.toLocaleDateString([], { month: "numeric", day: "numeric" });
    const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { ...d, time: `${date}|${time}`, fullTime: dt.toLocaleString() };
  });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={<StackedTick />} height={40} />
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
