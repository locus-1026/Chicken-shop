"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { ComplianceAudit, Outlet } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronRight,
} from "lucide-react";

const defaultChecklist = [
  "Food temperature logs up to date",
  "Staff in full uniform",
  "Back kitchen cleanliness",
  "Signage condition & branding",
  "POS till reconciliation",
  "First-aid kit complete",
];

const auditorOptions = [
  "HQ Ops — Tan Wei Ming",
  "HQ Ops — Mei Fong",
  "HQ Ops — Raj Kumar",
  "HQ Ops — Aisyah Abdullah",
  "External — SGS Malaysia",
];

// Monthly cadence — tweak if policy changes.
const AUDIT_CYCLE_DAYS = 30;
const SOON_THRESHOLD = 7; // flash "Due soon" when within this window of overdue

type OutletStatus = "never" | "overdue" | "soon" | "uptodate";

function daysBetween(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

function statusOf(lastAuditDate: string | undefined): { key: OutletStatus; label: string; tone: "danger" | "warning" | "success"; days: number | null } {
  if (!lastAuditDate) return { key: "never", label: "Never audited", tone: "danger", days: null };
  const d = daysBetween(lastAuditDate);
  if (d > AUDIT_CYCLE_DAYS) return { key: "overdue", label: `Overdue ${d - AUDIT_CYCLE_DAYS}d`, tone: "danger", days: d };
  if (d > AUDIT_CYCLE_DAYS - SOON_THRESHOLD) return { key: "soon", label: `Due in ${AUDIT_CYCLE_DAYS - d}d`, tone: "warning", days: d };
  return { key: "uptodate", label: `Up to date · ${d}d ago`, tone: "success", days: d };
}

const STATUS_ORDER: Record<OutletStatus, number> = { never: 0, overdue: 1, soon: 2, uptodate: 3 };

export default function AdminAuditsPage() {
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [audits, setAudits] = useState<ComplianceAudit[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [show, setShow] = useState(false);
  const [outletId, setOutletId] = useState<string>("");
  const [items, setItems] = useState(defaultChecklist.map((i) => ({ item: i, pass: true })));
  const [auditor, setAuditor] = useState(auditorOptions[0]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: auds }, { data: outs }] = await Promise.all([
      supabase.from("compliance_audits").select("*").order("audit_date", { ascending: false }),
      supabase.from("outlets").select("*").order("outlet_code"),
    ]);
    setAudits((auds ?? []) as ComplianceAudit[]);
    const olist = (outs ?? []) as Outlet[];
    setOutlets(olist);
    if (!outletId && olist.length > 0) setOutletId(olist[0].id);
  }, [supabase, outletId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-audits")
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_audits" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const score = Math.round((items.filter((i) => i.pass).length / items.length) * 100);

  const save = async () => {
    if (!auditor || auditor.replace("HQ Ops —", "").trim().length < 2) {
      toast("error", "Please pick an auditor.");
      return;
    }
    const prevTwo = audits.filter((a) => a.outlet_id === outletId).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)).slice(0, 1);
    const riskFlag = !!(prevTwo[0] && prevTwo[0].score < 80 && score < 80);
    const { error } = await supabase.from("compliance_audits").insert({
      outlet_id: outletId,
      audit_date: new Date().toISOString().slice(0, 10),
      score,
      checklist_items: items,
      auditor,
      signed_off_by: "Chan Kok Weng",
      risk_flag: riskFlag,
      notes: null,
    });
    if (error) { toast("error", `Save failed: ${error.message}`); return; }
    await load();
    setShow(false);
    setItems(defaultChecklist.map((i) => ({ item: i, pass: true })));
    toast(riskFlag ? "error" : "success", riskFlag
      ? `Audit saved. Outlet flagged at risk — ${score}% after two sub-80 scores.`
      : `Audit saved — score ${score}%.`);
  };

  // Build an "outlet summary" row for every outlet — one card each.
  const outletSummaries = useMemo(() => {
    return outlets
      .map((o) => {
        const its = audits.filter((a) => a.outlet_id === o.id).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1));
        const last = its[0];
        const last2 = its.slice(0, 2);
        const atRisk = last2.length === 2 && last2[0].score < 80 && last2[1].score < 80;
        const s = statusOf(last?.audit_date);
        return { outlet: o, last, audits: its, atRisk, status: s };
      })
      .sort((a, b) => {
        if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
        const aOrd = STATUS_ORDER[a.status.key];
        const bOrd = STATUS_ORDER[b.status.key];
        if (aOrd !== bOrd) return aOrd - bOrd;
        return a.outlet.outlet_code.localeCompare(b.outlet.outlet_code);
      });
  }, [outlets, audits]);

  const kpis = useMemo(() => {
    let overdue = 0, never = 0, atRisk = 0, uptodate = 0;
    for (const s of outletSummaries) {
      if (s.atRisk) atRisk += 1;
      if (s.status.key === "overdue") overdue += 1;
      else if (s.status.key === "never") never += 1;
      else if (s.status.key === "uptodate") uptodate += 1;
    }
    return { overdue, never, atRisk, uptodate, total: outletSummaries.length };
  }, [outletSummaries]);

  const needsActionCount = kpis.overdue + kpis.never;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={18} className="text-[color:var(--color-brand)]" /> Compliance audits
            </span>
          </CardTitle>
          <CardSubtitle>One card per outlet. Cards that need HQ action are pinned to the top.</CardSubtitle>
        </div>
        <Button onClick={() => setShow(true)}>+ New audit</Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Needs action" value={needsActionCount} sub="Overdue + never audited" tone={needsActionCount > 0 ? "danger" : "success"} />
        <Kpi label="Up to date" value={kpis.uptodate} sub={`of ${kpis.total} outlets`} tone="success" />
        <Kpi label="At risk" value={kpis.atRisk} sub="Two consecutive < 80%" tone={kpis.atRisk > 0 ? "danger" : "success"} />
        <Kpi label="Never audited" value={kpis.never} sub="Still no record" tone={kpis.never > 0 ? "warning" : "success"} />
      </div>

      {/* Outlet summary cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {outletSummaries.map((s) => (
          <OutletCard
            key={s.outlet.id}
            summary={s}
            onAudit={() => { setOutletId(s.outlet.id); setShow(true); }}
          />
        ))}
      </div>

      {/* History table, collapsed */}
      <Card className="!p-0 overflow-hidden">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[color:var(--color-brand-50)]/40"
        >
          <div className="flex items-center gap-2">
            {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="text-[14px] font-semibold">Full audit history</span>
            <span className="text-[12px] text-[color:var(--color-ink-soft)]">· {audits.length} records</span>
          </div>
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-[color:var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Outlet</th>
                  <th className="px-4 py-3">Auditor</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Failures</th>
                </tr>
              </thead>
              <tbody>
                {audits.sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)).map((a) => {
                  const o = outlets.find((x) => x.id === a.outlet_id);
                  if (!o) return null;
                  const tone = a.score >= 85 ? "success" : a.score >= 70 ? "warning" : "danger";
                  return (
                    <tr key={a.id} className="border-t border-[color:var(--color-border)]">
                      <td className="px-4 py-3">{formatDate(a.audit_date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.outlet_code}</div>
                        <div className="text-[11px] text-[color:var(--color-ink-soft)]">{o.location}</div>
                      </td>
                      <td className="px-4 py-3">{a.auditor}</td>
                      <td className="px-4 py-3"><Pill tone={tone}>{a.score}</Pill></td>
                      <td className="px-4 py-3">{a.checklist_items.filter((c) => !c.pass).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New audit modal */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-ink)]/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-5">
              <div>
                <h2 className="text-lg font-semibold">New audit</h2>
                <p className="text-[13px] text-[color:var(--color-ink-soft)]">Score auto-calculates as {score}%.</p>
              </div>
              <Button variant="ghost" onClick={() => setShow(false)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Outlet</span>
                  <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
                    {outlets.map((o) => <option key={o.id} value={o.id}>{o.outlet_code} — {o.location}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Auditor</span>
                  <select value={auditor} onChange={(e) => setAuditor(e.target.value)} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
                    {auditorOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <div className="mb-2 text-[12px] font-medium text-[color:var(--color-ink-soft)]">Checklist</div>
                <ul className="space-y-2">
                  {items.map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                      <span className="text-sm">{c.item}</span>
                      <label className="flex items-center gap-2 text-[12px] font-medium">
                        <input
                          type="checkbox"
                          checked={c.pass}
                          onChange={() => setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, pass: !x.pass } : x)))}
                          className="h-4 w-4 accent-[color:var(--color-brand)]"
                        />
                        Pass
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[color:var(--color-border)] p-4">
              <Pill tone={score >= 85 ? "success" : score >= 70 ? "warning" : "danger"}>Score {score}%</Pill>
              <Button onClick={save}>Save audit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Summary = {
  outlet: Outlet;
  last?: ComplianceAudit;
  audits: ComplianceAudit[];
  atRisk: boolean;
  status: ReturnType<typeof statusOf>;
};

function OutletCard({ summary, onAudit }: { summary: Summary; onAudit: () => void }) {
  const { outlet, last, audits, atRisk, status } = summary;
  const lastScoreTone = !last ? "neutral" : last.score >= 85 ? "success" : last.score >= 70 ? "warning" : "danger";
  const needsAction = status.key === "never" || status.key === "overdue" || atRisk;
  const StatusIcon =
    status.key === "never" ? XCircle
    : status.key === "overdue" ? AlertTriangle
    : status.key === "soon" ? Clock
    : CheckCircle2;

  return (
    <article
      className={
        "rounded-[14px] border bg-white p-4 transition-all hover:shadow-sm " +
        (needsAction ? "!border-[color:var(--color-danger)] !border-2 bg-[color:var(--color-danger-soft)]/30" : "border-[color:var(--color-border)]")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-semibold">{outlet.outlet_code}</div>
            {atRisk && <Pill tone="danger"><AlertTriangle size={10} /> At risk</Pill>}
          </div>
          <div className="truncate text-[12px] text-[color:var(--color-ink-soft)]">{outlet.location}</div>
        </div>
        <Pill tone={status.tone}>
          <StatusIcon size={10} /> {status.label}
        </Pill>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]/40 p-2.5">
        <MiniStat label="Last score" value={last ? String(last.score) : "—"} tone={lastScoreTone} />
        <MiniStat label="Last date" value={last ? formatDate(last.audit_date) : "—"} />
        <MiniStat label="Total" value={String(audits.length)} />
      </div>

      {last && (
        <div className="mt-2 text-[11px] text-[color:var(--color-ink-soft)]">
          Auditor: {last.auditor} · {last.checklist_items.filter((c) => !c.pass).length} failure(s)
        </div>
      )}

      <div className="mt-3">
        <Button size="sm" variant={needsAction ? "primary" : "outline"} onClick={onAudit}>
          {needsAction ? "Audit now" : "New audit"}
        </Button>
      </div>
    </article>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" | "neutral" }) {
  const cls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : "text-[color:var(--color-ink)]";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-0.5 text-[13px] font-semibold " + cls}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "success" | "warning" | "danger" }) {
  const cls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : "";
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-1 text-[24px] font-semibold leading-none " + cls}>{value}</div>
      <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
}
