"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { mockAudits, mockFranchisees, mockOutlets } from "@/lib/mock-data";
import type { Royalty } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RM, monthLabel, daysUntil } from "@/lib/utils";
import { Trophy, AlertTriangle, PhoneCall, FileWarning, Check } from "lucide-react";
import { ActionModal, type ActionKind } from "@/components/ui/ActionModal";
import { notifyFranchisee } from "@/lib/notify";
import type { Franchisee } from "@/lib/types";

export default function AdminDashboard() {
  const toast = useToast();
  const [actionTarget, setActionTarget] = useState<{ outletCode: string; ownerName: string; kind: ActionKind; businessName: string } | null>(null);
  // Real royalties + verified-proof map, so dashboard numbers agree with
  // /admin/royalties and the franchisee portal.
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [verifiedByRoyalty, setVerifiedByRoyalty] = useState<Record<string, boolean>>({});
  // Real franchisees from Supabase — we need the uuid to actually send a
  // notification (mockFranchisees ids like "f-1" don't link to anything).
  const [realFranchisees, setRealFranchisees] = useState<Franchisee[]>([]);
  // Latest HQ-notification response per franchisee so Needs attention
  // surfaces "Ahmad accepted" / "Ahmad proposed Thu 2pm" in real time.
  const [latestResponseByFr, setLatestResponseByFr] = useState<Record<string, { kind: string; status: string; response_note: string | null; responded_at: string }>>({});
  // Remember which franchisees HQ has already coached/noticed (localStorage so
  // it persists across sessions). Shown as a small pill on the "Needs attention"
  // row so HQ knows not to double-action.
  const [actioned, setActioned] = useState<Record<string, { coach?: string; notice?: string; solved?: string }>>({});

  useEffect(() => {
    // Restore actioned watermarks from localStorage.
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("cc.admin.actioned");
      if (raw) { try { setActioned(JSON.parse(raw)); } catch { /* ignore */ } }
    }
    const supabase = createSupabaseBrowserClient();
    const loadAll = async () => {
      const [{ data: roys }, { data: fs }, { data: profs }, { data: notifs }] = await Promise.all([
        supabase
          .from("royalties")
          .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
          .order("billing_period", { ascending: false }),
        supabase.from("franchisees").select("*"),
        supabase.from("profiles").select("id, franchisee_id"),
        supabase
          .from("notifications")
          .select("recipient_id, kind, status, response_note, responded_at")
          .not("responded_at", "is", null)
          .order("responded_at", { ascending: false }),
      ]);
      setRealFranchisees((fs ?? []) as Franchisee[]);
      // Resolve each response back to its franchisee via profiles.
      const profByUser: Record<string, string | null> = {};
      for (const p of ((profs ?? []) as { id: string; franchisee_id: string | null }[])) profByUser[p.id] = p.franchisee_id;
      const latest: Record<string, { kind: string; status: string; response_note: string | null; responded_at: string }> = {};
      for (const n of ((notifs ?? []) as { recipient_id: string; kind: string; status: string; response_note: string | null; responded_at: string }[])) {
        const fid = profByUser[n.recipient_id];
        if (!fid) continue;
        if (!latest[fid]) latest[fid] = { kind: n.kind, status: n.status, response_note: n.response_note, responded_at: n.responded_at };
      }
      setLatestResponseByFr(latest);
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
    };
    loadAll();
    // Live-refresh when a franchisee responds to a notification.
    const channel = supabase
      .channel("admin-dashboard-responses")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isPaid = (r: Royalty) => r.status === "paid" || !!verifiedByRoyalty[r.id];
  const isOverdue = (r: Royalty) => !isPaid(r) && (r.status === "overdue" || daysUntil(r.due_date) < 0);

  const totalSales = mockOutlets.reduce((s, o) => s + o.monthly_actual, 0);
  const totalTarget = mockOutlets.reduce((s, o) => s + o.monthly_target, 0);
  const totalRoyalties = royalties
    .filter(isPaid)
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
    const latestRoyalty = royalties
      .filter((r) => r.outlet_id === o.id)
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    const pct = (o.monthly_actual / o.monthly_target) * 100;
    const overdue = latestRoyalty ? isOverdue(latestRoyalty) : false;
    let tone: "success" | "warning" | "danger";
    if (overdue || (latest && latest.score < 70)) tone = "danger";
    else if (pct >= 90 && latest && latest.score >= 85) tone = "success";
    else tone = "warning";
    return { outlet: o, franchisee: f, audit: latest, royalty: latestRoyalty, pct, tone };
  });

  const top = [...outletsWithStatus].sort((a, b) => b.pct - a.pct).slice(0, 3);
  // Outlets the admin has marked "solved" this month drop out of Needs
  // attention until the 1st of next month, when the list resets.
  const thisMonthKey = new Date().toISOString().slice(0, 7); // "2026-04"
  const bottom = [...outletsWithStatus]
    .filter((x) => {
      const real = realFranchisees.find((f) => f.business_name === x.franchisee.business_name);
      const solved = real ? actioned[real.id]?.solved : undefined;
      return !(solved && solved.slice(0, 7) === thisMonthKey);
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  // Last 3 distinct billing periods from the real royalties table.
  const recentPeriods = [...new Set(royalties.map((r) => r.period))].slice(0, 3);
  const barData = recentPeriods.map((p) => ({
    month: monthLabel(p),
    total: royalties
      .filter((r) => r.period === p)
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
            {bottom.map((x) => {
              const real = realFranchisees.find((f) => f.business_name === x.franchisee.business_name);
              const history = real ? actioned[real.id] : undefined;
              return (
              <li key={x.outlet.id} className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{x.outlet.outlet_code} · {x.outlet.location}</div>
                    <div className="text-[12px] text-[color:var(--color-ink-soft)]">Owner {x.franchisee.owner_name}</div>
                    {history?.coach && (
                      <div className="mt-0.5 text-[11px] font-medium text-[color:var(--color-success)]">
                        ✓ Coaching scheduled · {new Date(history.coach).toLocaleDateString()}
                      </div>
                    )}
                    {history?.notice && (
                      <div className="mt-0.5 text-[11px] font-medium text-[color:var(--color-danger)]">
                        ✓ Warning notice issued · {new Date(history.notice).toLocaleDateString()}
                      </div>
                    )}
                    {real && latestResponseByFr[real.id] && (
                      <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--color-brand-700)]">
                        ↳ Franchisee: {
                          latestResponseByFr[real.id].status === "accepted" ? "accepted your invite"
                          : latestResponseByFr[real.id].status === "proposed" ? "proposed " + (latestResponseByFr[real.id].response_note ?? "alt time")
                          : latestResponseByFr[real.id].status === "acknowledged" ? "acknowledged notice"
                          : latestResponseByFr[real.id].status === "in_progress" ? "on it"
                          : latestResponseByFr[real.id].status === "done" ? "done"
                          : latestResponseByFr[real.id].status
                        }
                      </div>
                    )}
                  </div>
                  <Pill tone={x.tone === "danger" ? "danger" : x.tone === "warning" ? "warning" : "success"}>
                    {Math.round(x.pct)}% of target
                  </Pill>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionTarget({ outletCode: x.outlet.outlet_code, ownerName: x.franchisee.owner_name, kind: "coach", businessName: x.franchisee.business_name })}
                  >
                    <PhoneCall size={12} /> Schedule coaching call
                  </Button>
                  {x.tone === "danger" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActionTarget({ outletCode: x.outlet.outlet_code, ownerName: x.franchisee.owner_name, kind: "notice", businessName: x.franchisee.business_name })}
                    >
                      <FileWarning size={12} /> Issue warning notice
                    </Button>
                  )}
                  {real && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        const next = {
                          ...actioned,
                          [real.id]: { ...actioned[real.id], solved: new Date().toISOString() },
                        };
                        setActioned(next);
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem("cc.admin.actioned", JSON.stringify(next));
                        }
                        toast("success", `${x.outlet.outlet_code} marked solved for this month.`);
                      }}
                    >
                      <Check size={12} /> Mark solved
                    </Button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {actionTarget && (
        <ActionModal
          subjectCode={actionTarget.outletCode}
          ownerName={actionTarget.ownerName}
          kind={actionTarget.kind}
          onClose={() => setActionTarget(null)}
          onConfirm={async (summary) => {
            const supabase = createSupabaseBrowserClient();
            // Map the mock franchisee to a real Supabase franchisee by
            // business_name (seed data aligns the two on the same business_name).
            const target = actionTarget;
            const real = realFranchisees.find((f) => f.business_name === target.businessName);
            if (!real) {
              toast("error", "Couldn't find that franchisee in the DB — notification not sent.");
              return;
            }
            const { error } = await notifyFranchisee(supabase, real.id, {
              kind: target.kind === "coach" ? "coaching_call" : "warning_notice",
              title: target.kind === "coach"
                ? "HQ · Coaching call scheduled"
                : "HQ · Warning notice issued",
              body: summary,
              link: "/portal",
            });
            if (error) {
              toast("error", "Notification failed: " + (error as Error).message);
              return;
            }
            // Remember we actioned this franchisee so the card shows "Coached today".
            const next = {
              ...actioned,
              [real.id]: {
                ...actioned[real.id],
                [target.kind === "coach" ? "coach" : "notice"]: new Date().toISOString(),
              },
            };
            setActioned(next);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("cc.admin.actioned", JSON.stringify(next));
            }
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

