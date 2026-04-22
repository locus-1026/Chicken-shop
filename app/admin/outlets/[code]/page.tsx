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
  mockTrainingModules,
} from "@/lib/mock-data";
import type { Royalty } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RM, RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import {
  Phone,
  Mail,
  PhoneCall,
  FileWarning,
  Store,
  Utensils,
  ShoppingBag,
  Bike,
  Check,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

// Deterministic hash → integer.
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Synthetic channel mix per outlet so the drill-down is meaningful even when
// franchisees haven't been submitting mix data yet.
function syntheticMix(outletId: string) {
  const seed = hash(outletId);
  const dineIn   = 30 + (seed % 30);
  const takeaway = 25 + ((seed >> 3) % 25);
  const delivery = Math.max(5, 100 - dineIn - takeaway);
  return { dine_in: dineIn, takeaway, delivery, beverage: 12 + ((seed >> 5) % 15) };
}
function trainingPctForOutlet(outletId: string) {
  return 45 + (hash("train:" + outletId) % 55);
}

export default function OutletDetailPage() {
  const params = useParams<{ code: string }>();
  const toast = useToast();
  const [action, setAction] = useState<ActionKind | null>(null);
  const outlet = mockOutlets.find((o) => o.outlet_code === params.code);
  if (!outlet) return notFound();

  const franchisee = mockFranchisees.find((f) => f.id === outlet.franchisee_id)!;
  const latestAudit = mockAudits
    .filter((a) => a.outlet_id === outlet.id)
    .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))[0];
  const audits = useMemo(
    () => mockAudits.filter((a) => a.outlet_id === outlet.id).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)),
    [outlet.id]
  );
  // Real royalties + verified-proof ids for this outlet, pulled on mount.
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [verifiedByRoyalty, setVerifiedByRoyalty] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!outlet) return;
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: roys } = await supabase
        .from("royalties")
        .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
        .eq("outlet_id", outlet.id)
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
  }, [outlet]);
  const sales = useMemo(
    () => mockSalesReports.filter((r) => r.outlet_id === outlet.id).sort((a, b) => (a.report_date < b.report_date ? 1 : -1)),
    [outlet.id]
  );
  const tickets = useMemo(
    () => mockTickets.filter((t) => t.outlet_id === outlet.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [outlet.id]
  );

  const pct = Math.round((outlet.monthly_actual / outlet.monthly_target) * 100);
  const latestRoyalty = royalties[0];
  const overdueRoyalty = royalties.some(
    (r) => r.status !== "paid" && !verifiedByRoyalty[r.id] && daysUntil(r.due_date) < 0
  );

  const tone: "success" | "warning" | "danger" =
    overdueRoyalty || (latestAudit && latestAudit.score < 70)
      ? "danger"
      : pct >= 90 && latestAudit && latestAudit.score >= 85
      ? "success"
      : "warning";

  const trend = sales.slice(0, 30).reverse().map((r) => ({ date: r.report_date, value: r.gross_sales }));
  const mix = syntheticMix(outlet.id);
  const trainingPct = trainingPctForOutlet(outlet.id);

  const weekTotal = sales.slice(0, 7).reduce((s, r) => s + r.gross_sales, 0);
  const monthTxn  = sales.slice(0, 30).reduce((s, r) => s + r.transactions, 0);
  const avgTicket = monthTxn > 0 ? outlet.monthly_actual / monthTxn : 0;

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
              <Store size={14} /> Outlet profile
            </div>
            <h1 className="mt-1 text-2xl font-bold">{outlet.outlet_code}</h1>
            <div className="mt-0.5 text-[14px] text-[color:var(--color-ink)]">{outlet.location}</div>
            <div className="mt-1 text-[13px] text-[color:var(--color-ink-soft)]">
              <Link href={`/admin/franchisees/${franchisee.id}`} className="font-medium text-[color:var(--color-brand-700)] hover:underline">
                {franchisee.business_name}
              </Link>
              {" · "}Owner <b className="text-[color:var(--color-ink)]">{franchisee.owner_name}</b>
              {franchisee.risk_flag && <Pill tone="danger" className="ml-2">At-risk flag</Pill>}
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
              Opened {formatDate(outlet.opening_date)} · Agreement through {formatDate(franchisee.agreement_end)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${franchisee.contact.replace(/\s+/g, "")}`}>
              <Button variant="outline" size="sm"><Phone size={12} /> {franchisee.contact}</Button>
            </a>
            {franchisee.email && (
              <a href={`mailto:${franchisee.email}?subject=${encodeURIComponent(`${outlet.outlet_code} — follow-up from HQ`)}`}>
                <Button variant="outline" size="sm"><Mail size={12} /> Email</Button>
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
          label="Month sales"
          value={RM(outlet.monthly_actual)}
          sub={`${pct}% of ${RM(outlet.monthly_target)} target`}
          tone={pct >= 90 ? "success" : pct >= 70 ? "warning" : "danger"}
        />
        <Kpi
          label="Avg ticket"
          value={RM(Math.round(avgTicket))}
          sub={`${monthTxn.toLocaleString()} transactions this month`}
        />
        <Kpi
          label="Latest audit"
          value={latestAudit ? `${latestAudit.score}/100` : "—"}
          sub={latestAudit ? `${formatDate(latestAudit.audit_date)} · ${latestAudit.auditor}` : "No audit yet"}
          tone={latestAudit ? (latestAudit.score >= 85 ? "success" : latestAudit.score >= 70 ? "warning" : "danger") : undefined}
        />
        <Kpi
          label="Training complete"
          value={`${trainingPct}%`}
          sub={`${Math.round((trainingPct / 100) * mockTrainingModules.length)}/${mockTrainingModules.length} modules passed`}
          tone={trainingPct >= 80 ? "success" : trainingPct >= 60 ? "warning" : "danger"}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-[color:var(--color-brand)]" /> Sales trend · last 30 days</span>
            </CardTitle>
            <CardSubtitle>Week total {RM(weekTotal)} · Daily average {RM(Math.round(outlet.monthly_actual / 30))}</CardSubtitle>
          </div>
          <Pill tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "danger"}>{pct}% of target</Pill>
        </div>
        <div className="mt-4">
          <Sparkline data={trend} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Channel mix · last 30 days</CardTitle>
          <CardSubtitle>Where the revenue is coming from.</CardSubtitle>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[color:var(--color-border)]">
            <div style={{ width: mix.dine_in + "%" }}  className="bg-[color:var(--color-brand)]" />
            <div style={{ width: mix.takeaway + "%" }} className="bg-[color:var(--color-brand-300)]" />
            <div style={{ width: mix.delivery + "%" }} className="bg-[color:var(--color-brand-600)]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <MixStat icon={<Utensils size={14} />} label="Dine-in" value={mix.dine_in} />
            <MixStat icon={<ShoppingBag size={14} />} label="Takeaway" value={mix.takeaway} />
            <MixStat icon={<Bike size={14} />} label="Delivery" value={mix.delivery} />
          </div>
          <div className="mt-4 rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-[13px]">
            Beverage attach rate: <b>{mix.beverage}%</b> · Food {100 - mix.beverage}%
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Royalty status for this outlet</CardTitle>
              <CardSubtitle>Most recent 3 statements.</CardSubtitle>
            </div>
            <Link href="/admin/royalties" className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              Full royalties list →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {royalties.slice(0, 3).map((r) => {
              const effectivelyPaid = r.status === "paid" || !!verifiedByRoyalty[r.id];
              const st = effectivelyPaid ? "paid" : daysUntil(r.due_date) < 0 ? "overdue" : r.status;
              return (
                <li key={r.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{monthLabel(r.period)}</div>
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
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <CardTitle>Audit history for this outlet</CardTitle>
            <CardSubtitle>HQ compliance visits to {outlet.outlet_code} only.</CardSubtitle>
          </div>
          <Link href="/admin/audits" className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
            All-group audits list →
          </Link>
        </div>
        {audits.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-[color:var(--color-ink-soft)]">No audits recorded yet for this outlet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Auditor</th>
                <th className="px-4 py-3">Issues</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => {
                const failed = a.checklist_items.filter((c) => !c.pass).length;
                return (
                  <tr key={a.id} className="border-t border-[color:var(--color-border)]">
                    <td className="px-4 py-3 font-medium">{formatDate(a.audit_date)}</td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">{a.auditor}</td>
                    <td className="px-4 py-3">
                      {failed > 0 ? (
                        <Pill tone="danger">{failed} failed</Pill>
                      ) : (
                        <Pill tone="success">All passed</Pill>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--color-ink-soft)]">{a.notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <CardTitle>Open support tickets</CardTitle>
        <CardSubtitle>What this outlet has asked HQ for.</CardSubtitle>
        {tickets.length === 0 ? (
          <div className="mt-3 text-sm text-[color:var(--color-ink-soft)]">No tickets on record — smooth sailing.</div>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.subject}</span>
                    <Pill tone="neutral">{t.category}</Pill>
                  </div>
                  <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
                    Opened {formatDate(t.created_at)}
                  </div>
                  <div className="mt-1 truncate text-[13px] text-[color:var(--color-ink-soft)]">{t.description}</div>
                </div>
                <Pill tone={t.status === "resolved" ? "success" : t.status === "open" ? "warning" : "brand"}>
                  {t.status.replace("_", " ")}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <CardTitle>Recent daily sales — {outlet.outlet_code}</CardTitle>
            <CardSubtitle>Last 10 days reported by this outlet.</CardSubtitle>
          </div>
          <Link href={`/admin/franchisees/${franchisee.id}`} className="shrink-0 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
            Owner profile ({franchisee.owner_name.split(" ")[0]}) →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Gross sales</th>
              <th className="px-4 py-3">Transactions</th>
              <th className="px-4 py-3">Avg ticket</th>
            </tr>
          </thead>
          <tbody>
            {sales.slice(0, 10).map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                <td className="px-4 py-3 font-medium">{formatDate(r.report_date)}</td>
                <td className="px-4 py-3">{RM(r.gross_sales)}</td>
                <td className="px-4 py-3">{r.transactions}</td>
                <td className="px-4 py-3">{RM(Math.round(r.gross_sales / Math.max(1, r.transactions)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {action && (
        <ActionModal
          subjectCode={outlet.outlet_code}
          ownerName={franchisee.owner_name}
          kind={action}
          onClose={() => setAction(null)}
          onConfirm={({ summary }) => {
            setAction(null);
            toast("success", summary);
          }}
        />
      )}
    </div>
  );
}

function Kpi({
  href, label, value, sub, tone,
}: {
  href?: string;
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
  const card = (
    <Card className={href ? "h-full transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer" : ""}>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-2 text-[24px] font-semibold " + toneCls}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
  return href ? <Link href={href} className="block">{card}</Link> : card;
}

function MixStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-2 py-3">
      <div className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-ink-soft)]">{icon} {label}</div>
      <div className="mt-1 text-lg font-semibold">{value}%</div>
    </div>
  );
}
