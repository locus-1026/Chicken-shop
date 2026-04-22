"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { SalesDonut } from "@/components/charts/SalesDonut";
import { resolveMockOutletId } from "@/lib/mock-data";
import type { Royalty, ComplianceAudit } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { RM, RM2, daysUntil, formatDate } from "@/lib/utils";
import { Receipt, GraduationCap, ShoppingBasket, LifeBuoy, AlertTriangle, Check, Clock, ArrowUpRight } from "lucide-react";

const CHECKLIST_KEY = (outletId: string) => `cc.checklist.${outletId}`;
type ChecklistItem = { id: number; label: string; overdue: boolean; href: string };
const baseTodos: ChecklistItem[] = [
  { id: 1, label: "Submit today's sales report",       overdue: false, href: "/portal/sales" },
  { id: 2, label: "Complete Food Safety SOP training", overdue: true,  href: "/portal/training" },
  { id: 3, label: "Settle this month's royalty",       overdue: false, href: "/portal/royalty" },
  { id: 4, label: "Review latest marketing pack",      overdue: false, href: "/portal/marketing" },
];

export default function PortalHome() {
  const { outlet, franchisee } = useCurrentOutlet();
  const mockOutletId = resolveMockOutletId(outlet);
  // Live royalty lookup for this outlet — keeps home screen in sync with
  // /portal/royalty and /admin/royalties.
  const [latestRoyalty, setLatestRoyalty] = useState<Royalty | null>(null);
  const [latestVerified, setLatestVerified] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: roys } = await supabase
        .from("royalties")
        .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
        .eq("outlet_id", outlet.id)
        .order("billing_period", { ascending: false })
        .limit(1);
      const r = ((roys ?? []) as Royalty[])[0] ?? null;
      setLatestRoyalty(r);
      if (r) {
        const { data: proofRows } = await supabase
          .from("royalty_proofs")
          .select("verified_at")
          .eq("royalty_id", r.id)
          .limit(1);
        setLatestVerified(!!(proofRows?.[0]?.verified_at));
      }
    })();
  }, [outlet.id]);
  const royaltyStatus = latestRoyalty
    ? latestRoyalty.status === "paid" || latestVerified
      ? "paid"
      : daysUntil(latestRoyalty.due_date) < 0
      ? "overdue"
      : latestRoyalty.status
    : "pending";
  const royalty = latestRoyalty;
  // Live audit lookup for this outlet — reads from Supabase so the card
  // matches what /portal/compliance and HQ see.
  const [lastAudit, setLastAudit] = useState<ComplianceAudit | null>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const load = async () => {
      const { data } = await supabase
        .from("compliance_audits")
        .select("*")
        .eq("outlet_id", outlet.id)
        .order("audit_date", { ascending: false })
        .limit(1);
      setLastAudit(((data ?? []) as ComplianceAudit[])[0] ?? null);
    };
    load();
    const channel = supabase
      .channel("portal-home-audits-" + outlet.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_audits", filter: `outlet_id=eq.${outlet.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [outlet.id]);
  void mockOutletId; // still referenced earlier for other mock lookups

  // Per-outlet checklist state persisted to localStorage so ticks survive refreshes.
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CHECKLIST_KEY(outlet.id));
    setDoneMap(raw ? JSON.parse(raw) : { 4: true });
  }, [outlet.id]);

  const toggleDone = (id: number) => {
    const next = { ...doneMap, [id]: !doneMap[id] };
    setDoneMap(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHECKLIST_KEY(outlet.id), JSON.stringify(next));
    }
  };

  const todos = baseTodos.map((t) => ({ ...t, done: !!doneMap[t.id] }));

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
          <Link href="/portal/sales" className="block">
            <Card className="transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
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
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Link href="/portal/royalty" className="block">
          <Card className="transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
            <CardTitle>Royalty this month</CardTitle>
            {royalty ? (
              <>
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
              </>
            ) : (
              <>
                <CardSubtitle>No royalty statement yet.</CardSubtitle>
                <div className="mt-4 rounded-xl bg-[color:var(--color-brand-50)] px-4 py-6 text-center text-[13px] text-[color:var(--color-brand-700)]">
                  HQ generates your first statement after your first full month of trading.
                </div>
              </>
            )}
          </Card>
          </Link>
        </StaggerItem>
      </Stagger>

      <Stagger className="grid gap-5 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          {(() => {
            const doneCount = todos.filter((t) => t.done).length;
            const allDone = doneCount === todos.length;
            return (
          <Card className={allDone
            ? ""
            : "!border-[color:var(--color-danger)] !border-2"}>
            <div className="flex items-center justify-between">
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  Today&apos;s checklist
                  {!allDone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      <AlertTriangle size={10} /> Action needed
                    </span>
                  )}
                </span>
              </CardTitle>
              <span className={"text-[12px] " + (allDone ? "text-[color:var(--color-success)] font-semibold" : "text-[color:var(--color-ink-soft)]")}>
                {doneCount}/{todos.length} done
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-brand-50)]/50"
                >
                  <button
                    type="button"
                    onClick={() => toggleDone(t.id)}
                    aria-pressed={t.done}
                    aria-label={t.done ? "Mark as not done" : "Mark as done"}
                    className={
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors " +
                      (t.done
                        ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white"
                        : "border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-brand)]")
                    }
                  >
                    {t.done && <Check size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDone(t.id)}
                    className={
                      "flex-1 text-left text-sm " +
                      (t.done
                        ? "line-through text-[color:var(--color-ink-soft)]"
                        : t.overdue
                        ? "text-[color:var(--color-danger)] font-medium"
                        : "text-[color:var(--color-ink)]")
                    }
                  >
                    {t.label}
                  </button>
                  {t.overdue && !t.done && <Pill tone="danger">Overdue</Pill>}
                  <Link
                    href={t.href}
                    className="shrink-0 rounded-full p-1 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand-700)]"
                    title="Open page"
                    aria-label={`Open ${t.label}`}
                  >
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
            );
          })()}
        </StaggerItem>

        <StaggerItem>
          <Link href="/portal/compliance" className="block">
          <Card className="transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
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
                <span className="mt-4 inline-block text-[13px] font-medium text-[color:var(--color-brand-700)]">
                  View audit timeline →
                </span>
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
          </Link>
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
