"use client";

import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { SalesDonut } from "@/components/charts/SalesDonut";
import { mockRoyalties, mockAudits } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { RM, RM2, daysUntil, formatDate } from "@/lib/utils";
import { Receipt, GraduationCap, ShoppingBasket, LifeBuoy, AlertTriangle, Check, Clock } from "lucide-react";

export default function PortalHome() {
  const { outlet, franchisee } = useCurrentOutlet();
  const latestRoyalty = mockRoyalties
    .filter((r) => r.outlet_id === outlet.id)
    .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  const royaltyStatus = latestRoyalty
    ? latestRoyalty.status === "paid"
      ? "paid"
      : daysUntil(latestRoyalty.due_date) < 0
      ? "overdue"
      : latestRoyalty.status
    : "pending";
  const royalty = latestRoyalty;
  const lastAudit = mockAudits
    .filter((a) => a.outlet_id === outlet.id)
    .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))[0];

  const todos = [
    { id: 1, label: "Submit today's sales report", done: false, overdue: false, href: "/portal/sales" },
    { id: 2, label: "Complete Food Safety SOP training", done: false, overdue: true, href: "/portal/training" },
    { id: 3, label: "Settle April royalty", done: false, overdue: false, href: "/portal/royalty" },
    { id: 4, label: "Review Mother's Day marketing pack", done: true, overdue: false, href: "/portal/marketing" },
  ];

  return (
    <div className="space-y-6">
      {franchisee.risk_flag && (
        <div className="flex items-center gap-3 rounded-[16px] border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] p-4 text-[color:var(--color-danger)]">
          <AlertTriangle size={20} />
          <div className="flex-1 text-sm">
            <b>At-risk status</b> — two consecutive audits below 80. HQ will reach out within 48 hours.
          </div>
        </div>
      )}

      <Stagger className="grid gap-5 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex-1">
                <CardTitle>This month's sales</CardTitle>
                <CardSubtitle>
                  {RM(outlet.monthly_actual)} of {RM(outlet.monthly_target)} target
                </CardSubtitle>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <MiniStat label="Target" value={RM(outlet.monthly_target)} />
                  <MiniStat label="Actual" value={RM(outlet.monthly_actual)} tone="brand" />
                  <MiniStat label="Gap" value={RM(Math.abs(outlet.monthly_target - outlet.monthly_actual))} />
                </div>
              </div>
              <div className="w-full max-w-[260px]">
                <SalesDonut actual={outlet.monthly_actual} target={outlet.monthly_target} />
              </div>
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardTitle>Royalty this month</CardTitle>
            <CardSubtitle>{formatDate(royalty.period)}</CardSubtitle>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-[28px] font-semibold">{RM2(royalty.royalty_amount + royalty.marketing_fee)}</div>
                <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                  Royalty {RM2(royalty.royalty_amount)} · Marketing {RM2(royalty.marketing_fee)}
                </div>
              </div>
              <Pill tone={royaltyStatus === "paid" ? "success" : royaltyStatus === "overdue" ? "danger" : "warning"}>
                {royaltyStatus === "paid" ? <Check size={12} /> : <Clock size={12} />}
                {royaltyStatus}
              </Pill>
            </div>
            <div className="mt-4 text-[12px] text-[color:var(--color-ink-soft)]">
              Due {formatDate(royalty.due_date)} ·{" "}
              {daysUntil(royalty.due_date) >= 0
                ? `${daysUntil(royalty.due_date)} days left`
                : `${Math.abs(daysUntil(royalty.due_date))} days overdue`}
            </div>
          </Card>
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-5 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Today's checklist</CardTitle>
              <span className="text-[12px] text-[color:var(--color-ink-soft)]">
                {todos.filter((t) => t.done).length}/{todos.length} done
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {todos.map((t) => (
                <li key={t.id}>
                  <Link
                    href={t.href}
                    className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-brand-50)]/50"
                  >
                    <span
                      className={
                        "flex h-5 w-5 items-center justify-center rounded-full border " +
                        (t.done ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white" : "border-[color:var(--color-border)]")
                      }
                    >
                      {t.done && <Check size={12} />}
                    </span>
                    <span
                      className={
                        "flex-1 text-sm " +
                        (t.done
                          ? "line-through text-[color:var(--color-ink-soft)]"
                          : t.overdue
                          ? "text-[color:var(--color-danger)] font-medium"
                          : "text-[color:var(--color-ink)]")
                      }
                    >
                      {t.label}
                    </span>
                    {t.overdue && !t.done && <Pill tone="danger">Overdue</Pill>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardTitle>Last audit</CardTitle>
            {lastAudit ? (
              <>
                <CardSubtitle>{formatDate(lastAudit.audit_date)}</CardSubtitle>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className={
                      "flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold " +
                      (lastAudit.score >= 85
                        ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                        : lastAudit.score >= 70
                        ? "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]"
                        : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]")
                    }
                  >
                    {lastAudit.score}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{lastAudit.auditor}</div>
                    <div className="text-[color:var(--color-ink-soft)]">
                      {lastAudit.checklist_items.filter((c) => !c.pass).length} item(s) failed
                    </div>
                  </div>
                </div>
                <Link href="/portal/compliance" className="mt-4 inline-block text-[13px] font-medium text-[color:var(--color-brand-700)]">
                  View audit timeline →
                </Link>
              </>
            ) : (
              <>
                <CardSubtitle>No audits yet for this outlet.</CardSubtitle>
                <div className="mt-4 rounded-xl bg-[color:var(--color-brand-50)] px-4 py-6 text-center text-[13px] text-[color:var(--color-brand-700)]">
                  HQ will schedule your first audit within 30 days of opening.
                </div>
              </>
            )}
          </Card>
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/portal/sales"     icon={<Receipt size={18} />}      label="Report Sales" />
        <QuickAction href="/portal/training"  icon={<GraduationCap size={18}/>} label="View Training" />
        <QuickAction href="/portal/supplies"  icon={<ShoppingBasket size={18}/>} label="Order Supplies" />
        <QuickAction href="/portal/support"   icon={<LifeBuoy size={18} />}     label="Get Help" />
      </Stagger>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div
      className={
        "rounded-xl border border-[color:var(--color-border)] px-2 py-3 " +
        (tone === "brand" ? "bg-[color:var(--color-brand-50)]" : "bg-white")
      }
    >
      <div className="text-[11px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">{label}</div>
      <div className="mt-1 text-[14px] font-semibold">{value}</div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <StaggerItem>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-[16px] border border-[color:var(--color-border)] bg-white p-4 transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          {icon}
        </div>
        <div className="font-medium">{label}</div>
      </Link>
    </StaggerItem>
  );
}
