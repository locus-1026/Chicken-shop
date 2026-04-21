"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export function SalesDonut({ actual, target }: { actual: number; target: number }) {
  const pct = Math.min(100, Math.round((actual / target) * 100));
  const data = [
    { name: "achieved", value: pct },
    { name: "remaining", value: 100 - pct },
  ];
  const color = pct >= 100 ? "#3B6D11" : pct >= 80 ? "#E8590C" : "#A32D2D";

  return (
    <div className="relative h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius="70%"
            outerRadius="95%"
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="#F4E7D6" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[42px] font-semibold leading-none" style={{ color }}>{pct}%</span>
        <span className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">of monthly target</span>
      </div>
    </div>
  );
}
