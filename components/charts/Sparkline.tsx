"use client";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  // Short "23 Apr" label for x-axis ticks.
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short" });

  // Date tooltip header — e.g. "Wed, 23 Apr".
  const fmtLong = (d: string) =>
    new Date(d).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" });

  // Only show dates up to yesterday (today's number is still in-progress
  // and would skew the visual — chart reader expects completed days only).
  const yesterdayIso = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();
  const trimmed = data.filter((d) => d.date.slice(0, 10) <= yesterdayIso);

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer>
        <AreaChart data={trimmed} margin={{ top: 2, right: 10, left: 10, bottom: 20 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8590C" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#E8590C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={fmt}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            tick={{ fontSize: 9, fill: "#8a8077" }}
            height={40}
          />
          <Tooltip
            cursor={{ stroke: "#E8590C", strokeOpacity: 0.25 }}
            contentStyle={{ borderRadius: 10, border: "1px solid rgba(232,89,12,0.25)", fontSize: 12 }}
            labelFormatter={(d) => fmtLong(d as string)}
            formatter={(v: number) => ["RM " + v.toLocaleString(), "Sales"]}
          />
          <Area type="monotone" dataKey="value" stroke="#E8590C" strokeWidth={2} fill="url(#sparkFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
