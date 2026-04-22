"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ActionModal, type ActionKind } from "@/components/ui/ActionModal";
import { useToast } from "@/components/ui/Toast";
import { Sparkline } from "@/components/charts/Sparkline";
import {
  mockAudits,
  mockFranchisees,
  mockOutlets,
  mockSalesReports,
  mockTickets,
  mockSupplyOrders,
} from "@/lib/mock-data";
import type { Royalty } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RM, RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import {
  Phone,
  Mail,
  PhoneCall,
  FileWarning,
  FileSignature,
  X,
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

const RENEWAL_KEY = (id: string) => `cc.contract-renewal.${id}`;
type Renewal = { newEnd: string; renewedAt: string; term: string; notes?: string };

export default function FranchiseeDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  // Real royalty rows + proofs loaded from Supabase so this page agrees with
  // /admin/royalties and the franchisee's own portal view.
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [verifiedByRoyalty, setVerifiedByRoyalty] = useState<Record<string, boolean>>({});
  const franchisee = mockFranchisees.find((f) => f.id === params.id);

  useEffect(() => {
    if (!franchisee || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(RENEWAL_KEY(franchisee.id));
    setRenewal(raw ? (JSON.parse(raw) as Renewal) : null);
  }, [franchisee]);

  // Fetch live royalties for this franchisee's outlets.
  useEffect(() => {
    if (!franchisee) return;
    const supabase = createSupabaseBrowserClient();
    const outletIds = mockOutlets
      .filter((o) => o.franchisee_id === franchisee.id)
      .map((o) => o.id);
    if (outletIds.length === 0) return;
    (async () => {
      const { data: roys } = await supabase
        .from("royalties")
        .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
        .in("outlet_id", outletIds)
        .order("billing_period", { ascending: false });
      const rs = (roys ?? []) as Royalty[];
      setRoyalties(rs);
      if (rs.length > 0) {
        const { data: proofRows } = await supabase
          .from("royalty_proofs")
          .select("royalty_id, verified_at")
          .in("royalty_id", rs.map((r) => r.id));
        const v: Record<string, boolean> = {};
        for (const p of (proofRows ?? []) as { royalty_id: string; verified_at: string | null }[]) {
          if (p.verified_at) v[p.royalty_id] = true;
        }
        setVerifiedByRoyalty(v);
      }
    })();
  }, [franchisee]);

  if (!franchisee) return notFound();

  // Use the renewed end date if a renewal has been recorded.
  const effectiveEnd = renewal?.newEnd ?? franchisee.agreement_end;

  const saveRenewal = (r: Renewal) => {
    setRenewal(r);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RENEWAL_KEY(franchisee.id), JSON.stringify(r));
    }
  };

  const outlets = mockOutlets.filter((o) => o.franchisee_id === franchisee.id);
  const outletIds = outlets.map((o) => o.id);

  const agg = useMemo(() => {
    const monthlyActual = outlets.reduce((s, o) => s + o.monthly_actual, 0);
    const monthlyTarget = outlets.reduce((s, o) => s + o.monthly_target, 0);
    const audits = mockAudits.filter((a) => outletIds.includes(a.outlet_id));
    const avgAudit = audits.length ? audits.reduce((s, a) => s + a.score, 0) / audits.length : null;
    // Use the live royalties fetched above (already filtered to this franchisee's outlets).
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
  }, [outlets, outletIds, royalties]);

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

  const contractDaysLeft = daysUntil(effectiveEnd);
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
              IC {franchisee.ic_number} · {outlets.length} outlet{outlets.length !== 1 ? "s" : ""} · Agreement {formatDate(franchisee.agreement_start)} → {formatDate(effectiveEnd)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${franchisee.contact.replace(/\s+/g, "")}`}>
              <Button variant="outline" size="sm"><Phone size={12} /> {franchisee.contact}</Button>
            </a>
            {franchisee.email && (
              <a href={`mailto:${franchisee.email}?subject=${encodeURIComponent(`${franchisee.business_name} — follow-up from HQ`)}`}>
                <Button variant="outline" size="sm"><Mail size={12} /> {franchisee.email}</Button>
              </a>
            )}
            <Button size="sm" onClick={() => setAction("coach")}>
              <PhoneCall size={12} /> Schedule coaching
            </Button>
            {tone === "danger" && (
              <Button variant="outline" size="sm" onClick={() => setAction("notice")}>
                <FileWarning size={12} /> Issue notice
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Combined month sales"
          value={RM(agg.monthlyActual)}
          sub={`${agg.salesPct}% of ${RM(agg.monthlyTarget)} target`}
          tone={agg.salesPct >= 90 ? "success" : agg.salesPct >= 70 ? "warning" : "danger"}
        />
        <Kpi
          label="Outstanding royalty"
          value={RM2(agg.outstanding)}
          sub={agg.overdueCount > 0 ? `${agg.overdueCount} overdue statement${agg.overdueCount > 1 ? "s" : ""}` : "All settled or pending"}
          tone={agg.overdueCount > 0 ? "danger" : agg.outstanding > 0 ? "warning" : "success"}
        />
        <Kpi
          label="Avg audit score"
          value={agg.avgAudit !== null ? `${Math.round(agg.avgAudit)}/100` : "—"}
          sub={agg.audits.length > 0 ? `${agg.audits.length} visit${agg.audits.length > 1 ? "s" : ""} on record` : "No audits yet"}
          tone={agg.avgAudit !== null ? (agg.avgAudit >= 85 ? "success" : agg.avgAudit >= 70 ? "warning" : "danger") : undefined}
        />
        <Kpi
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
            const latestRoyalty = royalties
              .filter((r) => r.outlet_id === o.id && r.status !== "paid" && !verifiedByRoyalty[r.id])
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
        <Card className="h-full">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex items-center gap-2"><Receipt size={16} className="text-[color:var(--color-brand)]" /> Royalty statements for {franchisee.owner_name.split(" ")[0]}</span>
              </CardTitle>
              <CardSubtitle>Last 3 across all their outlets.</CardSubtitle>
            </div>
            <Link href="/admin/royalties" className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              Full royalties list →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {agg.royalties
              .sort((a, b) => (a.period < b.period ? 1 : -1))
              .slice(0, 3)
              .map((r) => {
                // Treat a verified-proof row as paid even if the royalties row
                // hasn't been flipped yet (race between two admin writes).
                const effectiveStatus = r.status === "paid" || verifiedByRoyalty[r.id] ? "paid" : r.status;
                const st = effectiveStatus === "paid" ? "paid" : daysUntil(r.due_date) < 0 ? "overdue" : effectiveStatus;
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
        </Card>

        <Card className="h-full">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[color:var(--color-brand)]" /> Audits for {franchisee.owner_name.split(" ")[0]}</span>
              </CardTitle>
              <CardSubtitle>Last 3 across all their outlets.</CardSubtitle>
            </div>
            <Link href="/admin/audits" className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              Full audits list →
            </Link>
          </div>
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
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Contract</CardTitle>
              <CardSubtitle>Agreement term + renewal timing.</CardSubtitle>
            </div>
            <Button size="sm" onClick={() => setRenewOpen(true)}>
              <FileSignature size={14} /> Renew contract
            </Button>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Agreement start" value={formatDate(franchisee.agreement_start)} />
            <Row
              label="Agreement end"
              value={
                <span className="inline-flex items-center gap-2">
                  {formatDate(effectiveEnd)}
                  {renewal && (
                    <Pill tone="brand" className="ml-1">Renewed</Pill>
                  )}
                </span>
              }
            />
            <Row
              label="Days remaining"
              value={
                <Pill tone={contractTone}>
                  {contractDaysLeft >= 0 ? `${contractDaysLeft} days` : `Expired ${Math.abs(contractDaysLeft)} days ago`}
                </Pill>
              }
            />
            <Row label="Status" value={<Pill tone={franchisee.status === "active" ? "success" : "warning"}>{franchisee.status}</Pill>} />
            {renewal && (
              <div className="rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-3 py-2 text-[12px] text-[color:var(--color-brand-700)]">
                Renewed {formatDate(renewal.renewedAt)} · {renewal.term}
                {renewal.notes && <div className="mt-1 italic text-[color:var(--color-ink-soft)]">{renewal.notes}</div>}
              </div>
            )}
          </div>
        </Card>

        <Card className="h-full">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex items-center gap-2"><Package size={16} className="text-[color:var(--color-brand)]" /> Supply orders for {franchisee.owner_name.split(" ")[0]}</span>
              </CardTitle>
              <CardSubtitle>Across all their outlets.</CardSubtitle>
            </div>
            <Link href="/admin/supplies" className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              Manage all orders →
            </Link>
          </div>
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
        </Card>
      </div>

      {action && (
        <ActionModal
          subjectCode={franchisee.business_name}
          ownerName={franchisee.owner_name}
          kind={action}
          onClose={() => setAction(null)}
          onConfirm={(summary) => {
            setAction(null);
            toast("success", summary);
          }}
        />
      )}

      {renewOpen && (
        <RenewContractModal
          businessName={franchisee.business_name}
          ownerName={franchisee.owner_name}
          currentEnd={effectiveEnd}
          onClose={() => setRenewOpen(false)}
          onConfirm={(r) => {
            saveRenewal(r);
            setRenewOpen(false);
            toast("success", `Contract renewed — now ends ${formatDate(r.newEnd)}.`);
          }}
        />
      )}
    </div>
  );
}

function RenewContractModal({
  businessName,
  ownerName,
  currentEnd,
  onClose,
  onConfirm,
}: {
  businessName: string;
  ownerName: string;
  currentEnd: string;
  onClose: () => void;
  onConfirm: (r: Renewal) => void;
}) {
  const addYears = (iso: string, years: number) => {
    const d = new Date(iso);
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  };

  const [term, setTerm] = useState<1 | 2 | 3 | 5 | "custom">(3);
  const [customEnd, setCustomEnd] = useState(addYears(currentEnd, 3));
  const [notes, setNotes] = useState("");

  const newEnd = term === "custom" ? customEnd : addYears(currentEnd, term);

  const submit = () => {
    if (!newEnd || new Date(newEnd) <= new Date(currentEnd)) {
      return;
    }
    onConfirm({
      newEnd,
      renewedAt: new Date().toISOString(),
      term: term === "custom" ? `Custom — ends ${formatDate(newEnd)}` : `+${term} year${term > 1 ? "s" : ""}`,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
              Renew franchise contract
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{businessName}</h3>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
              Owner {ownerName} · Current end {formatDate(currentEnd)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Renewal term</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([1, 2, 3, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setTerm(n)}
                  className={
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors " +
                    (term === n
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]"
                      : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand-200)]")
                  }
                >
                  +{n} year{n > 1 ? "s" : ""}
                </button>
              ))}
              <button
                onClick={() => setTerm("custom")}
                className={
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors " +
                  (term === "custom"
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]"
                    : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand-200)]")
                }
              >
                Custom
              </button>
            </div>
          </div>

          {term === "custom" && (
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">New end date</span>
              <input
                type="date"
                value={customEnd}
                min={new Date(currentEnd).toISOString().slice(0, 10)}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
              />
            </label>
          )}

          <div className="rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[13px] text-[color:var(--color-brand-700)]">
            New agreement end: <b>{formatDate(newEnd)}</b>
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Renewed on improved terms after Q1 performance review."
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
            />
          </label>

          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2.5 text-[12px] text-[color:var(--color-ink-soft)]">
            Both franchisor and franchisee will receive the renewal e-packet. The existing royalty and marketing levy carry over unless you attach an amendment.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={new Date(newEnd) <= new Date(currentEnd)}>
            <FileSignature size={14} /> Confirm renewal
          </Button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, tone,
}: {
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
    <Card className="h-full">
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-2 text-[22px] font-semibold " + toneCls}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
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
