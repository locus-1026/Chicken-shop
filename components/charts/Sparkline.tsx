"use client";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  // Short "23 Apr" label for x-axis ticks.
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short" });

  // Date tooltip header — e.g. "Wed, 23 Apr".
  const fmtLong = (d: string) =>
    new Date(d).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 8, left: 8, bottom: 0 }}>
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
            interval="preserveStartEnd"
            minTickGap={48}
            tick={{ fontSize: 10, fill: "#8a8077" }}
            height={18}
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
