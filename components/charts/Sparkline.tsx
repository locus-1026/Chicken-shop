"use client";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

export function Sparkline({ data }: { data: { date: string; value: number }[] }) {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8590C" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#E8590C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: "#E8590C", strokeOpacity: 0.25 }}
            contentStyle={{ borderRadius: 10, border: "1px solid rgba(232,89,12,0.25)", fontSize: 12 }}
            formatter={(v: number) => "RM " + v.toLocaleString()}
          />
          <Area type="monotone" dataKey="value" stroke="#E8590C" strokeWidth={2} fill="url(#sparkFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
