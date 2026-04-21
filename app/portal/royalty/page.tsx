"use client";

import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { mockRoyalties } from "@/lib/mock-data";
import { RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import { Check, Clock, AlertCircle } from "lucide-react";

export default function RoyaltyPage() {
  const { outlet } = useCurrentOutlet();
  const rows = mockRoyalties
    .filter((r) => r.outlet_id === outlet.id)
    .sort((a, b) => (a.period < b.period ? 1 : -1));

  const effectiveStatus = (r: (typeof rows)[number]) =>
    r.status === "paid" ? "paid" : daysUntil(r.due_date) < 0 ? "overdue" : r.status;

  const outstanding = rows
    .filter((r) => effectiveStatus(r) !== "paid")
    .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[color:var(--color-brand-50)] to-white !border-[color:var(--color-brand-200)]">
        <CardTitle>Royalty summary</CardTitle>
        <CardSubtitle>Royalty 5% of gross sales · Marketing levy 2% · Due 14th of the following month.</CardSubtitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3">
            <div className="text-[12px] text-[color:var(--color-ink-soft)]">Total outstanding</div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--color-danger)]">{RM2(outstanding)}</div>
          </div>
          <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3">
            <div className="text-[12px] text-[color:var(--color-ink-soft)]">Payment instructions</div>
            <div className="mt-1 text-[13px]">Maybank <b>5142 1234 5678</b> · ref <b>{outlet.outlet_code}</b></div>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Gross sales</th>
              <th className="px-4 py-3">Royalty 5%</th>
              <th className="px-4 py-3">Marketing 2%</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = effectiveStatus(r);
              return (
                <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-3 font-medium">{monthLabel(r.period)}</td>
                  <td className="px-4 py-3">{RM2(r.gross_sales)}</td>
                  <td className="px-4 py-3">{RM2(r.royalty_amount)}</td>
                  <td className="px-4 py-3">{RM2(r.marketing_fee)}</td>
                  <td className="px-4 py-3 font-semibold">{RM2(r.royalty_amount + r.marketing_fee)}</td>
                  <td className="px-4 py-3">{formatDate(r.due_date)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={st === "paid" ? "success" : st === "overdue" ? "danger" : "warning"}>
                      {st === "paid" ? <Check size={12} /> : st === "overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}
                      {st}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
