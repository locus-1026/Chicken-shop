"use client";

import { useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockOutlets, mockRoyalties, mockFranchisees } from "@/lib/mock-data";
import { RM, RM2, monthLabel } from "@/lib/utils";
import { calcRoyalty } from "@/lib/utils";
import { notifyRoyaltyDue } from "@/lib/mocks/notifications";
import type { Royalty } from "@/lib/types";

export default function AdminRoyaltiesPage() {
  const periods = [...new Set(mockRoyalties.map((r) => r.period))].sort().reverse();
  const [period, setPeriod] = useState(periods[0]);
  const [rows, setRows] = useState<Royalty[]>(mockRoyalties);

  const filtered = useMemo(() => rows.filter((r) => r.period === period), [rows, period]);

  const editGross = (id: string, g: number) => {
    const c = calcRoyalty(g);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, gross_sales: g, royalty_amount: c.royalty, marketing_fee: c.marketing } : r)));
  };

  const markPaid = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid", paid_at: new Date().toISOString() } : r)));
  };

  const markAllPaid = () => {
    setRows((prev) =>
      prev.map((r) =>
        r.period === period && r.status !== "paid"
          ? { ...r, status: "paid", paid_at: new Date().toISOString() }
          : r
      )
    );
  };

  const sendReminders = async () => {
    for (const r of filtered.filter((x) => x.status !== "paid")) {
      const outlet = mockOutlets.find((o) => o.id === r.outlet_id)!;
      const f = mockFranchisees.find((x) => x.id === outlet.franchisee_id)!;
      await notifyRoyaltyDue(outlet.outlet_code, f.email ?? "unknown@coco.my", r.royalty_amount + r.marketing_fee);
    }
    alert(`Sent ${filtered.filter((x) => x.status !== "paid").length} reminders (check console).`);
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross_sales,
      due:   acc.due + r.royalty_amount + r.marketing_fee,
      paid:  acc.paid + (r.status === "paid" ? r.royalty_amount + r.marketing_fee : 0),
    }),
    { gross: 0, due: 0, paid: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Royalty statements</CardTitle>
          <CardSubtitle>Pick a month, edit gross sales, mark settlements.</CardSubtitle>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {periods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </select>
          <Button variant="outline" onClick={sendReminders}>Send reminders</Button>
          <Button onClick={markAllPaid}>Mark all paid</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Total gross</div><div className="mt-1 text-xl font-semibold">{RM(totals.gross)}</div></Card>
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Billed (roy + mkt)</div><div className="mt-1 text-xl font-semibold">{RM2(totals.due)}</div></Card>
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Collected</div><div className="mt-1 text-xl font-semibold text-[color:var(--color-success)]">{RM2(totals.paid)}</div></Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Gross sales</th>
              <th className="px-4 py-3">Royalty 5%</th>
              <th className="px-4 py-3">Marketing 2%</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const outlet = mockOutlets.find((o) => o.id === r.outlet_id)!;
              return (
                <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{outlet.outlet_code}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{outlet.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={r.gross_sales}
                      onChange={(e) => editGross(r.id, Number(e.target.value))}
                      className="w-32 rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-4 py-3">{RM2(r.royalty_amount)}</td>
                  <td className="px-4 py-3">{RM2(r.marketing_fee)}</td>
                  <td className="px-4 py-3 font-semibold">{RM2(r.royalty_amount + r.marketing_fee)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={r.status === "paid" ? "success" : r.status === "overdue" ? "danger" : "warning"}>
                      {r.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status !== "paid" && (
                      <Button size="sm" variant="success" onClick={() => markPaid(r.id)}>Mark paid</Button>
                    )}
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
