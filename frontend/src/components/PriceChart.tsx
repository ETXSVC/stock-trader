import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

export function PriceChart({ data }: { data: { timestamp: string; price: number | null }[] }) {
  const formatted = data.map((d) => {
    const dt = parseUTC(d.timestamp);
    const date = dt.toLocaleDateString([], { month: "numeric", day: "numeric" });
    const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { ...d, time: `${date}|${time}`, fullTime: dt.toLocaleString() };
  });
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={<StackedTick />} height={40} />
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
