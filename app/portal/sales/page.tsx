"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/charts/Sparkline";
import { fireConfetti } from "@/components/ui/Confetti";
import { mockSalesReports } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { RM, formatDate } from "@/lib/utils";

export default function SalesPage() {
  const { outlet } = useCurrentOutlet();
  const [reports, setReports] = useState(
    mockSalesReports.filter((s) => s.outlet_id === outlet.id).sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
  );
  const [gross, setGross] = useState("");
  const [transactions, setTransactions] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setReports(
      mockSalesReports.filter((s) => s.outlet_id === outlet.id).sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
    );
    setMessage(null);
  }, [outlet.id]);

  const avg = useMemo(
    () => reports.slice(0, 30).reduce((s, r) => s + r.gross_sales, 0) / Math.max(1, reports.length),
    [reports]
  );

  const last30 = useMemo(
    () => [...reports].slice(0, 30).reverse().map((r) => ({ date: r.report_date, value: r.gross_sales })),
    [reports]
  );

  const submit = () => {
    const g = Number(gross);
    if (!g) return;
    const today = new Date().toISOString().slice(0, 10);
    const newReport = {
      id: "s-new-" + Date.now(),
      outlet_id: outlet.id,
      report_date: today,
      gross_sales: g,
      transactions: Number(transactions) || 0,
      notes: null,
    };
    setReports([newReport, ...reports.filter((r) => r.report_date !== today)]);
    setGross("");
    setTransactions("");
    if (g > avg) {
      setMessage(`🔥 ${RM(g)} beats your daily average of ${RM(Math.round(avg))}. Keep cooking!`);
      fireConfetti();
    } else {
      setMessage(`Logged ${RM(g)} for ${formatDate(today)}.`);
    }
    setTimeout(() => setMessage(null), 6000);
  };

  const weekTotal = reports.slice(0, 7).reduce((s, r) => s + r.gross_sales, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Log today's sales</CardTitle>
          <CardSubtitle>Submit before you close up. One entry per day.</CardSubtitle>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Gross sales (RM)</span>
              <input
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                type="number"
                placeholder="e.g. 5800"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-lg font-semibold focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Transactions</span>
              <input
                value={transactions}
                onChange={(e) => setTransactions(e.target.value)}
                type="number"
                placeholder="e.g. 132"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-lg font-semibold focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={submit} size="lg">Submit today's sales</Button>
            {message && (
              <span className="text-[13px] font-medium text-[color:var(--color-success)]">{message}</span>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>This week</CardTitle>
          <CardSubtitle>Total of the last 7 days</CardSubtitle>
          <div className="mt-4 text-[34px] font-semibold">{RM(weekTotal)}</div>
          <div className="mt-2 text-[12px] text-[color:var(--color-ink-soft)]">
            Daily average {RM(Math.round(avg))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Last 30 days</CardTitle>
        <Sparkline data={last30} />
      </Card>

      <Card>
        <CardTitle>Recent entries</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Gross sales</th>
                <th className="py-2 pr-4">Transactions</th>
                <th className="py-2 pr-4">vs. average</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 10).map((r) => {
                const diff = r.gross_sales - avg;
                return (
                  <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                    <td className="py-2.5 pr-4 font-medium">{formatDate(r.report_date)}</td>
                    <td className="py-2.5 pr-4">{RM(r.gross_sales)}</td>
                    <td className="py-2.5 pr-4">{r.transactions}</td>
                    <td className="py-2.5 pr-4">
                      <Pill tone={diff >= 0 ? "success" : "warning"}>
                        {diff >= 0 ? "▲" : "▼"} {RM(Math.abs(Math.round(diff)))}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
