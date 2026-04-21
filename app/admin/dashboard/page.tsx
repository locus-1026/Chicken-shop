"use client";

import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { mockAudits, mockFranchisees, mockOutlets, mockRoyalties } from "@/lib/mock-data";
import { RM, monthLabel } from "@/lib/utils";
import { Trophy, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const totalSales = mockOutlets.reduce((s, o) => s + o.monthly_actual, 0);
  const totalTarget = mockOutlets.reduce((s, o) => s + o.monthly_target, 0);
  const totalRoyalties = mockRoyalties
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);
  const avgAuditScore =
    mockAudits.reduce((s, a) => s + a.score, 0) / mockAudits.length;
  const trainingCompletion = 62;

  const outletsWithStatus = mockOutlets.map((o) => {
    const f = mockFranchisees.find((x) => x.id === o.franchisee_id)!;
    const latest = mockAudits
      .filter((a) => a.outlet_id === o.id)
      .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))[0];
    const latestRoyalty = mockRoyalties
      .filter((r) => r.outlet_id === o.id)
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    const pct = (o.monthly_actual / o.monthly_target) * 100;
    let tone: "success" | "warning" | "danger" = "success";
    if (latestRoyalty?.status === "overdue" || (latest && latest.score < 70)) tone = "danger";
    else if (pct < 80 || (latest && latest.score < 85)) tone = "warning";
    return { outlet: o, franchisee: f, audit: latest, royalty: latestRoyalty, pct, tone };
  });

  const top = [...outletsWithStatus].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const bottom = [...outletsWithStatus].sort((a, b) => a.pct - b.pct).slice(0, 3);

  const barData = ["3m","2m","1m"].map((_, i) => ({
    month: monthLabel(mockRoyalties[i].period),
    total: mockRoyalties
      .filter((r) => r.period === mockRoyalties[i].period)
      .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0),
  }));

  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Monthly sales"       value={RM(totalSales)}                sub={`${Math.round((totalSales/totalTarget)*100)}% of RM ${totalTarget.toLocaleString()} target`} />
        <Kpi label="Royalties collected" value={RM(totalRoyalties)}            sub="Last 3 months, settled" />
        <Kpi label="Compliance pass %"   value={`${Math.round(avgAuditScore)}`} sub="Avg. audit score" />
        <Kpi label="Training completion" value={`${trainingCompletion}%`}       sub="Across all users" />
      </Stagger>

      <Card>
        <CardTitle>Outlet traffic lights</CardTitle>
        <CardSubtitle>Green = on target + compliant. Amber = needs a look. Red = act now.</CardSubtitle>
        <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {outletsWithStatus.map((x) => (
            <StaggerItem key={x.outlet.id}>
              <div
                className={
                  "rounded-[16px] border p-4 " +
                  (x.tone === "success"
                    ? "border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
                    : x.tone === "warning"
                    ? "border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]"
                    : "border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold">{x.outlet.outlet_code}</span>
                  <span
                    className={
                      "h-3 w-3 rounded-full " +
                      (x.tone === "success"
                        ? "bg-[color:var(--color-success)]"
                        : x.tone === "warning"
                        ? "bg-[color:var(--color-warning)]"
                        : "bg-[color:var(--color-danger)]")
                    }
                  />
                </div>
                <div className="mt-2 text-[12px] text-[color:var(--color-ink-soft)]">{x.outlet.location}</div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-[20px] font-semibold">{Math.round(x.pct)}%</span>
                  <span className="text-[11px] text-[color:var(--color-ink-soft)]">
                    {x.audit ? `Audit ${x.audit.score}` : "No audit"}
                  </span>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><Trophy size={16} className="text-[color:var(--color-brand)]"/> Top 3 performers</span>
          </CardTitle>
          <CardSubtitle>By % of monthly target</CardSubtitle>
          <div className="mt-6 flex items-end justify-center gap-4">
            {[top[1], top[0], top[2]].map((p, i) => (
              <div key={p.outlet.id} className="flex w-24 flex-col items-center">
                <div
                  className="flex w-full items-end justify-center rounded-t-xl bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)] font-bold"
                  style={{ height: [90, 130, 70][i] }}
                >
                  <span className="pb-2 text-lg">{i === 1 ? "🥇" : i === 0 ? "🥈" : "🥉"}</span>
                </div>
                <div className="mt-2 text-center text-[12px] font-semibold">{p.outlet.outlet_code}</div>
                <div className="text-[11px] text-[color:var(--color-ink-soft)]">{Math.round(p.pct)}%</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><AlertTriangle size={16} className="text-[color:var(--color-warning)]"/> Needs attention</span>
          </CardTitle>
          <CardSubtitle>Not shame — just where HQ should focus.</CardSubtitle>
          <ul className="mt-3 space-y-2">
            {bottom.map((x) => (
              <li key={x.outlet.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">{x.outlet.outlet_code} · {x.outlet.location}</div>
                  <div className="text-[12px] text-[color:var(--color-ink-soft)]">Owner {x.franchisee.owner_name}</div>
                </div>
                <Pill tone={x.tone === "danger" ? "danger" : x.tone === "warning" ? "warning" : "success"}>
                  {Math.round(x.pct)}% of target
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Royalty collection — last 3 months</CardTitle>
        <div className="mt-4 h-64">
          <ResponsiveContainer>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="2 4" stroke="#F0DCC2" vertical={false} />
              <XAxis dataKey="month" stroke="#6B4A35" fontSize={12} />
              <YAxis stroke="#6B4A35" fontSize={12} tickFormatter={(v) => "RM " + (v/1000).toFixed(0) + "k"} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid rgba(232,89,12,0.25)", fontSize: 12 }}
                formatter={(v: number) => RM(v)}
              />
              <Bar dataKey="total" fill="#E8590C" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <StaggerItem>
      <Card>
        <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
        <div className="mt-2 text-[26px] font-semibold">{value}</div>
        <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
      </Card>
    </StaggerItem>
  );
}
