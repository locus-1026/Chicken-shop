"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { mockAudits, mockFranchisees, mockOutlets, mockRoyalties } from "@/lib/mock-data";
import { RM, monthLabel } from "@/lib/utils";
import { Trophy, AlertTriangle, PhoneCall, FileWarning, X } from "lucide-react";

type ActionKind = "coach" | "notice";

export default function AdminDashboard() {
  const toast = useToast();
  const [actionTarget, setActionTarget] = useState<{ outletCode: string; ownerName: string; kind: ActionKind } | null>(null);

  const totalSales = mockOutlets.reduce((s, o) => s + o.monthly_actual, 0);
  const totalTarget = mockOutlets.reduce((s, o) => s + o.monthly_target, 0);
  const totalRoyalties = mockRoyalties
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);
  const avgAuditScore =
    mockAudits.reduce((s, a) => s + a.score, 0) / mockAudits.length;
  const trainingCompletion = 62;

  // Traffic-light rules:
  //   🟢 green  = sales ≥ 90%  AND  audit ≥ 85  AND  no overdue royalty
  //   🔴 red    = audit < 70  OR  overdue royalty
  //   🟡 amber  = everything in between (incl. "no audit yet")
  const outletsWithStatus = mockOutlets.map((o) => {
    const f = mockFranchisees.find((x) => x.id === o.franchisee_id)!;
    const latest = mockAudits
      .filter((a) => a.outlet_id === o.id)
      .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))[0];
    const latestRoyalty = mockRoyalties
      .filter((r) => r.outlet_id === o.id)
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    const pct = (o.monthly_actual / o.monthly_target) * 100;
    const overdue = latestRoyalty?.status === "overdue";
    let tone: "success" | "warning" | "danger";
    if (overdue || (latest && latest.score < 70)) tone = "danger";
    else if (pct >= 90 && latest && latest.score >= 85) tone = "success";
    else tone = "warning";
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
        <Kpi href="/admin/franchisees" label="Monthly sales"       value={RM(totalSales)}                sub={`${Math.round((totalSales/totalTarget)*100)}% of RM ${totalTarget.toLocaleString()} target`} />
        <Kpi href="/admin/royalties"   label="Royalties collected" value={RM(totalRoyalties)}            sub="Last 3 months, settled" />
        <ComplianceKpi score={avgAuditScore} />
        <Kpi href="/admin/training"    label="Training completion" value={`${trainingCompletion}%`}       sub="Across all users · target 90%" />
      </Stagger>

      <Card>
        <CardTitle>Outlet traffic lights</CardTitle>
        <CardSubtitle>
          Green = sales ≥ 90% <b>and</b> audit ≥ 85. Red = audit &lt; 70 or overdue royalty. Amber = anything in between.
        </CardSubtitle>
        <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {outletsWithStatus.map((x) => (
            <StaggerItem key={x.outlet.id}>
              <Link
                href={`/admin/outlets/${x.outlet.outlet_code}`}
                className={
                  "block rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
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
              </Link>
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
              <li key={x.outlet.id} className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{x.outlet.outlet_code} · {x.outlet.location}</div>
                    <div className="text-[12px] text-[color:var(--color-ink-soft)]">Owner {x.franchisee.owner_name}</div>
                  </div>
                  <Pill tone={x.tone === "danger" ? "danger" : x.tone === "warning" ? "warning" : "success"}>
                    {Math.round(x.pct)}% of target
                  </Pill>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionTarget({ outletCode: x.outlet.outlet_code, ownerName: x.franchisee.owner_name, kind: "coach" })}
                  >
                    <PhoneCall size={12} /> Schedule coaching call
                  </Button>
                  {x.tone === "danger" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActionTarget({ outletCode: x.outlet.outlet_code, ownerName: x.franchisee.owner_name, kind: "notice" })}
                    >
                      <FileWarning size={12} /> Issue warning notice
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {actionTarget && (
        <ActionModal
          outletCode={actionTarget.outletCode}
          ownerName={actionTarget.ownerName}
          kind={actionTarget.kind}
          onClose={() => setActionTarget(null)}
          onConfirm={(summary) => {
            setActionTarget(null);
            toast("success", summary);
          }}
        />
      )}

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

function Kpi({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const card = (
    <Card className={href ? "transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer" : ""}>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className="mt-2 text-[26px] font-semibold">{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
  return <StaggerItem>{href ? <Link href={href} className="block">{card}</Link> : card}</StaggerItem>;
}

// Compliance band: ≥85 pass · 70-84 watch · <70 fail.
function ComplianceKpi({ score }: { score: number }) {
  const rounded = Math.round(score);
  const band =
    rounded >= 85 ? { label: "Pass", tone: "text-[color:var(--color-success)]" }
    : rounded >= 70 ? { label: "Watch", tone: "text-[color:var(--color-warning)]" }
    : { label: "Fail", tone: "text-[color:var(--color-danger)]" };
  const pct = Math.max(0, Math.min(100, rounded));
  return (
    <StaggerItem>
      <Link href="/admin/audits" className="block">
        <Card className="transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Compliance audit score</div>
            <Pill tone={rounded >= 85 ? "success" : rounded >= 70 ? "warning" : "danger"}>{band.label}</Pill>
          </div>
          <div className={"mt-2 text-[26px] font-semibold " + band.tone}>
            {rounded}<span className="text-sm font-normal text-[color:var(--color-ink-soft)]"> / 100</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-border)]">
            <div
              style={{ width: pct + "%" }}
              className={
                rounded >= 85 ? "h-full bg-[color:var(--color-success)]"
                : rounded >= 70 ? "h-full bg-[color:var(--color-warning)]"
                : "h-full bg-[color:var(--color-danger)]"
              }
            />
          </div>
          <div className="mt-2 text-[11px] text-[color:var(--color-ink-soft)]">
            <b>≥85</b> pass · <b>70–84</b> watch · <b>&lt;70</b> risk flag
          </div>
        </Card>
      </Link>
    </StaggerItem>
  );
}

function ActionModal({
  outletCode, ownerName, kind, onClose, onConfirm,
}: {
  outletCode: string;
  ownerName: string;
  kind: ActionKind;
  onClose: () => void;
  onConfirm: (summary: string) => void;
}) {
  const isCoach = kind === "coach";
  const [when, setWhen] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const defaultNote = isCoach
    ? `Hi ${ownerName.split(" ")[0]}, noticing ${outletCode} tracking below target. Let's jump on a 30-min call to walk through operations and marketing support.`
    : `Formal notice: ${outletCode} has been below compliance / sales threshold for a sustained period. Please respond with a recovery plan within 7 days. This goes on record per the franchise agreement.`;
  const [note, setNote] = useState(defaultNote);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div className={"text-[11px] font-semibold uppercase tracking-wider " + (isCoach ? "text-[color:var(--color-brand-700)]" : "text-[color:var(--color-danger)]")}>
              {isCoach ? "Schedule coaching call" : "Issue warning notice"}
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{outletCode} · {ownerName}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isCoach && (
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">When</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">
              {isCoach ? "Message to franchisee" : "Notice content (goes on record)"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
            />
          </label>
          {!isCoach && (
            <div className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-2.5 text-[12px] text-[color:var(--color-danger)]">
              Warning notices are logged against the franchise agreement. Three active notices trigger a committee review.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onConfirm(
                isCoach
                  ? `Coaching call scheduled with ${ownerName} (${outletCode}) — invite sent.`
                  : `Warning notice issued to ${outletCode}. Franchisee and the agreement file have been notified.`
              )
            }
          >
            {isCoach ? (<><PhoneCall size={14} /> Send invite</>) : (<><FileWarning size={14} /> Issue notice</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
