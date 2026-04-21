"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  mockAudits,
  mockFranchisees,
  mockOutlets,
  mockRoyalties,
  mockSalesReports,
  mockTickets,
  mockSupplyOrders,
} from "@/lib/mock-data";
import { RM, RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Mail,
  PhoneCall,
  FileWarning,
  Store,
  TrendingUp,
  Receipt,
  ShieldCheck,
  Package,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

export default function FranchiseeDetailPage() {
  const params = useParams<{ id: string }>();
  const franchisee = mockFranchisees.find((f) => f.id === params.id);
  if (!franchisee) return notFound();

  const outlets = mockOutlets.filter((o) => o.franchisee_id === franchisee.id);
  const outletIds = outlets.map((o) => o.id);

  const agg = useMemo(() => {
    const monthlyActual = outlets.reduce((s, o) => s + o.monthly_actual, 0);
    const monthlyTarget = outlets.reduce((s, o) => s + o.monthly_target, 0);
    const audits = mockAudits.filter((a) => outletIds.includes(a.outlet_id));
    const avgAudit = audits.length ? audits.reduce((s, a) => s + a.score, 0) / audits.length : null;
    const royalties = mockRoyalties.filter((r) => outletIds.includes(r.outlet_id));
    const outstanding = royalties
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);
    const overdueCount = royalties.filter((r) => r.status !== "paid" && daysUntil(r.due_date) < 0).length;
    const tickets = mockTickets.filter((t) => outletIds.includes(t.outlet_id ?? ""));
    const openTickets = tickets.filter((t) => t.status !== "resolved").length;
    const orders = mockSupplyOrders.filter((o) => outletIds.includes(o.outlet_id));
    const openOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
    return {
      monthlyActual, monthlyTarget, salesPct: monthlyTarget ? Math.round((monthlyActual / monthlyTarget) * 100) : 0,
      avgAudit, audits, royalties, outstanding, overdueCount,
      tickets, openTickets, orders, openOrders,
    };
  }, [outlets, outletIds]);

  // Rolled-up 30-day sales trend across all outlets owned by this franchisee.
  const trend = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of mockSalesReports) {
      if (!outletIds.includes(r.outlet_id)) continue;
      byDate.set(r.report_date, (byDate.get(r.report_date) ?? 0) + r.gross_sales);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-30)
      .map(([date, value]) => ({ date, value }));
  }, [outletIds]);

  const contractDaysLeft = daysUntil(franchisee.agreement_end);
  const contractTone: "success" | "warning" | "danger" =
    contractDaysLeft <= 30 ? "danger" : contractDaysLeft <= 90 ? "warning" : "success";

  const tone: "success" | "warning" | "danger" =
    agg.overdueCount > 0 || (agg.avgAudit !== null && agg.avgAudit < 70)
      ? "danger"
      : agg.salesPct >= 90 && agg.avgAudit !== null && agg.avgAudit >= 85
      ? "success"
      : "warning";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/franchisees"
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        <ArrowLeft size={14} /> Back to all franchisees
      </Link>

      <Card
        className={
          tone === "success"
            ? "!border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
            : tone === "warning"
            ? "!border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]"
            : "!border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              <Store size={14} /> Franchisee profile
            </div>
            <h1 className="mt-1 text-2xl font-bold">{franchisee.business_name}</h1>
            <div className="mt-0.5 text-[14px]">
              Owner <b>{franchisee.owner_name}</b>
              {franchisee.risk_flag && <Pill tone="danger" className="ml-2">At-risk flag</Pill>}
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
              IC {franchisee.ic_number} · {outlets.length} outlet{outlets.length !== 1 ? "s" : ""} · Agreement {formatDate(franchisee.agreement_start)} → {formatDate(franchisee.agreement_end)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm"><Phone size={12} /> {franchisee.contact}</Button>
            {franchisee.email && <Button variant="outline" size="sm"><Mail size={12} /> {franchisee.email}</Button>}
            <Button size="sm"><PhoneCall size={12} /> Schedule coaching</Button>
            {tone === "danger" && (
              <Button variant="outline" size="sm"><FileWarning size={12} /> Issue notice</Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiLink
          href="/admin/royalties"
          label="Combined month sales"
          value={RM(agg.monthlyActual)}
          sub={`${agg.salesPct}% of ${RM(agg.monthlyTarget)} target`}
          tone={agg.salesPct >= 90 ? "success" : agg.salesPct >= 70 ? "warning" : "danger"}
        />
        <KpiLink
          href="/admin/royalties"
          label="Outstanding royalty"
          value={RM2(agg.outstanding)}
          sub={agg.overdueCount > 0 ? `${agg.overdueCount} overdue statement${agg.overdueCount > 1 ? "s" : ""}` : "All settled or pending"}
          tone={agg.overdueCount > 0 ? "danger" : agg.outstanding > 0 ? "warning" : "success"}
        />
        <KpiLink
          href="/admin/audits"
          label="Avg audit score"
          value={agg.avgAudit !== null ? `${Math.round(agg.avgAudit)}/100` : "—"}
          sub={agg.audits.length > 0 ? `${agg.audits.length} visit${agg.audits.length > 1 ? "s" : ""} on record` : "No audits yet"}
          tone={agg.avgAudit !== null ? (agg.avgAudit >= 85 ? "success" : agg.avgAudit >= 70 ? "warning" : "danger") : undefined}
        />
        <KpiLink
          href="/admin/supplies"
          label="Open supply orders"
          value={`${agg.openOrders}`}
          sub={`${agg.orders.length} lifetime across outlets`}
          tone={agg.openOrders > 2 ? "warning" : undefined}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-[color:var(--color-brand)]" /> Combined sales trend · last 30 days</span>
            </CardTitle>
            <CardSubtitle>Rolled up across every outlet this franchisee operates.</CardSubtitle>
          </div>
          <Pill tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "danger"}>{agg.salesPct}% of target</Pill>
        </div>
        <div className="mt-4">
          <Sparkline data={trend} />
        </div>
      </Card>

      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><Store size={16} className="text-[color:var(--color-brand)]" /> Outlets</span>
        </CardTitle>
        <CardSubtitle>Click an outlet for a deeper look.</CardSubtitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {outlets.map((o) => {
            const pct = Math.round((o.monthly_actual / o.monthly_target) * 100);
            const latestAudit = mockAudits
              .filter((a) => a.outlet_id === o.id)
              .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))[0];
            const latestRoyalty = mockRoyalties
              .filter((r) => r.outlet_id === o.id && r.status !== "paid")
              .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
            const overdue = latestRoyalty && daysUntil(latestRoyalty.due_date) < 0;
            const outletTone =
              overdue || (latestAudit && latestAudit.score < 70) ? "danger"
              : pct >= 90 && latestAudit && latestAudit.score >= 85 ? "success"
              : "warning";
            return (
              <Link key={o.id} href={`/admin/outlets/${o.outlet_code}`} className="block">
                <div
                  className={
                    "rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
                    (outletTone === "success"
                      ? "border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
                      : outletTone === "warning"
                      ? "border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]"
                      : "border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold">{o.outlet_code}</div>
                      <div className="truncate text-[12px] text-[color:var(--color-ink-soft)]">{o.location}</div>
                    </div>
                    <ChevronRight size={16} className="text-[color:var(--color-ink-soft)]" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px]">
                    <div>
                      <div className="font-semibold">{pct}%</div>
                      <div className="text-[10px] text-[color:var(--color-ink-soft)]">target</div>
                    </div>
                    <div>
                      <div className="font-semibold">{latestAudit ? latestAudit.score : "—"}</div>
                      <div className="text-[10px] text-[color:var(--color-ink-soft)]">audit</div>
                    </div>
                    <div>
                      <div className="font-semibold">{RM(o.monthly_actual)}</div>
                      <div className="text-[10px] text-[color:var(--color-ink-soft)]">month</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Link href="/admin/royalties" className="block">
          <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
            <CardTitle>
              <span className="inline-flex items-center gap-2"><Receipt size={16} className="text-[color:var(--color-brand)]" /> Recent royalty activity</span>
            </CardTitle>
            <CardSubtitle>Last 3 statements across all outlets.</CardSubtitle>
            <ul className="mt-3 space-y-2">
              {agg.royalties
                .sort((a, b) => (a.period < b.period ? 1 : -1))
                .slice(0, 3)
                .map((r) => {
                  const st = r.status === "paid" ? "paid" : daysUntil(r.due_date) < 0 ? "overdue" : r.status;
                  const outlet = outlets.find((o) => o.id === r.outlet_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                      <div>
                        <div className="text-sm font-semibold">{monthLabel(r.period)} · {outlet?.outlet_code ?? ""}</div>
                        <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                          Due {formatDate(r.due_date)} · {RM2(r.royalty_amount + r.marketing_fee)}
                        </div>
                      </div>
                      <Pill tone={st === "paid" ? "success" : st === "overdue" ? "danger" : "warning"}>
                        {st === "paid" ? <Check size={12} /> : st === "overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}
                        {st}
                      </Pill>
                    </li>
                  );
                })}
            </ul>
            <div className="mt-3 text-[12px] font-medium text-[color:var(--color-brand-700)]">
              View all statements →
            </div>
          </Card>
        </Link>

        <Link href="/admin/audits" className="block">
          <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
            <CardTitle>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[color:var(--color-brand)]" /> Recent audits</span>
            </CardTitle>
            <CardSubtitle>HQ compliance visits.</CardSubtitle>
            {agg.audits.length === 0 ? (
              <div className="mt-3 text-sm text-[color:var(--color-ink-soft)]">No audits recorded yet.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {agg.audits
                  .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))
                  .slice(0, 3)
                  .map((a) => {
                    const outlet = outlets.find((o) => o.id === a.outlet_id);
                    const failed = a.checklist_items.filter((c) => !c.pass).length;
                    return (
                      <li key={a.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                        <div>
                          <div className="text-sm font-semibold">{outlet?.outlet_code ?? ""} · {formatDate(a.audit_date)}</div>
                          <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                            {a.auditor} · {failed > 0 ? `${failed} failed` : "all passed"}
                          </div>
                        </div>
                        <span
                          className={
                            "inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold " +
                            (a.score >= 85
                              ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                              : a.score >= 70
                              ? "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]"
                              : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]")
                          }
                        >
                          {a.score}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
            <div className="mt-3 text-[12px] font-medium text-[color:var(--color-brand-700)]">
              View all audits →
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Contract</CardTitle>
          <CardSubtitle>Agreement term + renewal timing.</CardSubtitle>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Agreement start" value={formatDate(franchisee.agreement_start)} />
            <Row label="Agreement end"   value={formatDate(franchisee.agreement_end)} />
            <Row
              label="Days remaining"
              value={
                <Pill tone={contractTone}>
                  {contractDaysLeft >= 0 ? `${contractDaysLeft} days` : `Expired ${Math.abs(contractDaysLeft)} days ago`}
                </Pill>
              }
            />
            <Row label="Status" value={<Pill tone={franchisee.status === "active" ? "success" : "warning"}>{franchisee.status}</Pill>} />
          </div>
        </Card>

        <Link href="/admin/supplies" className="block">
          <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
            <CardTitle>
              <span className="inline-flex items-center gap-2"><Package size={16} className="text-[color:var(--color-brand)]" /> Supply orders</span>
            </CardTitle>
            <CardSubtitle>Across all their outlets.</CardSubtitle>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-3">
                <div className="text-[12px] text-[color:var(--color-ink-soft)]">Open</div>
                <div className="mt-1 text-2xl font-semibold text-[color:var(--color-brand-700)]">{agg.openOrders}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-3">
                <div className="text-[12px] text-[color:var(--color-ink-soft)]">Delivered lifetime</div>
                <div className="mt-1 text-2xl font-semibold">
                  {agg.orders.filter((o) => o.status === "delivered").length}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[12px] font-medium text-[color:var(--color-brand-700)]">
              Manage orders →
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function KpiLink({
  href, label, value, sub, tone,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : "";
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
        <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
        <div className={"mt-2 text-[22px] font-semibold " + toneCls}>{value}</div>
        <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
      </Card>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
      <span className="text-[color:var(--color-ink-soft)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
