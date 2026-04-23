"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Stagger, StaggerItem } from "@/components/ui/Stagger";
import { mockAudits, mockFranchisees, mockOutlets } from "@/lib/mock-data";
import type { Royalty, Outlet } from "@/lib/types";
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
  // Real outlets from Supabase — the royalties table stores real UUIDs, so
  // the per-outlet collection grid has to iterate real outlets (mockOutlets
  // use "o-1" style ids which never match the real outlet_id column).
  const [realOutlets, setRealOutlets] = useState<Outlet[]>([]);
  // Real month-to-date sales, so the 'Monthly sales' KPI matches what /admin/sales shows.
  const [mtdByOutlet, setMtdByOutlet] = useState<Record<string, number>>({});
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
      // Build safe month bounds in LOCAL time. Don't use toISOString() —
      // in GMT+8 that converts '2026-04-01 00:00 local' to '2026-03-31
      // 16:00 UTC', which then sliced back to '2026-03-31' and pulled
      // an extra day of sales into the MTD sum (RM 26,005 drift vs
      // /admin/sales). Formatting YYYY-MM-DD directly avoids the shift.
      const now = new Date();
      const yy = now.getFullYear();
      const mm = now.getMonth(); // 0-indexed
      const pad = (n: number) => String(n).padStart(2, "0");
      const firstOfMonth = `${yy}-${pad(mm + 1)}-01`;
      const firstOfNext = mm === 11 ? `${yy + 1}-01-01` : `${yy}-${pad(mm + 2)}-01`;
      const [{ data: roys }, { data: fs }, { data: profs }, { data: notifs }, { data: outs }, { data: mtdRows }] = await Promise.all([
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
        supabase.from("outlets").select("*").order("outlet_code"),
        supabase
          .from("sales_reports")
          .select("outlet_id, gross_sales")
          .gte("report_date", firstOfMonth)
          .lt("report_date", firstOfNext),
      ]);
      const mtd: Record<string, number> = {};
      for (const r of ((mtdRows ?? []) as { outlet_id: string; gross_sales: number }[])) {
        mtd[r.outlet_id] = (mtd[r.outlet_id] ?? 0) + r.gross_sales;
      }
      setMtdByOutlet(mtd);
      setRealFranchisees((fs ?? []) as Franchisee[]);
      setRealOutlets((outs ?? []) as Outlet[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isPaid = (r: Royalty) => r.status === "paid" || !!verifiedByRoyalty[r.id];
  const isOverdue = (r: Royalty) => !isPaid(r) && (r.status === "overdue" || daysUntil(r.due_date) < 0);

  // Prefer real MTD sums + real targets (matches /admin/sales). Falls back
  // to mockOutlets while the live data is still loading on first paint so
  // the KPI never flashes '0'.
  const totalSales = realOutlets.length > 0
    ? realOutlets.reduce((s, o) => s + (mtdByOutlet[o.id] ?? 0), 0)
    : mockOutlets.reduce((s, o) => s + o.monthly_actual, 0);
  const totalTarget = realOutlets.length > 0
    ? realOutlets.reduce((s, o) => s + (o.monthly_target ?? 0), 0)
    : mockOutlets.reduce((s, o) => s + o.monthly_target, 0);
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
    // Match the mock outlet to its real counterpart via outlet_code so
    // traffic-lights + Top 3 performers use the SAME MTD number and
    // monthly_target that /admin/sales shows. Without this the two pages
    // disagreed (96% vs 63%) because the mock seed was hard-coded.
    const real = realOutlets.find((x) => x.outlet_code === o.outlet_code);
    const realMtd = real ? (mtdByOutlet[real.id] ?? 0) : o.monthly_actual;
    const realTarget = real?.monthly_target ?? o.monthly_target;
    const latestRoyalty = royalties
      .filter((r) => r.outlet_id === (real?.id ?? o.id))
      .sort((a, b) => (a.period < b.period ? 1 : -1))[0];
    const pct = realTarget > 0 ? (realMtd / realTarget) * 100 : 0;
    const overdue = latestRoyalty ? isOverdue(latestRoyalty) : false;
    let tone: "success" | "warning" | "danger";
    if (overdue || (latest && latest.score < 70)) tone = "danger";
    else if (pct >= 90 && latest && latest.score >= 85) tone = "success";
    else tone = "warning";
    // Expose real numbers so the cards below display the same RM values
    // as /admin/sales instead of the stale seed values.
    const outletForDisplay = { ...o, monthly_actual: realMtd, monthly_target: realTarget };
    return { outlet: outletForDisplay, franchisee: f, audit: latest, royalty: latestRoyalty, pct, tone };
  });

  const top = [...outletsWithStatus].sort((a, b) => b.pct - a.pct).slice(0, 3);
  // Outlets the admin has marked "solved" this month drop out of Needs
  // attention until the 1st of next month, when the list resets.
  const thisMonthKey = new Date().toISOString().slice(0, 7); // "2026-04"
  const bottom = [...outletsWithStatus]
    // Only outlets that actually need HQ attention — amber or red. Healthy
    // outlets (green: ≥90% sales, audit ≥85, no overdue royalty) don't
    // belong in "Needs attention" even if they're the lowest of the bunch.
    .filter((x) => x.tone !== "success")
    .filter((x) => {
      const real = realFranchisees.find((f) => f.business_name === x.franchisee.business_name);
      const solved = real ? actioned[real.id]?.solved : undefined;
      return !(solved && solved.slice(0, 7) === thisMonthKey);
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  // Last 3 distinct billing periods from the real royalties table.
  const recentPeriods = [...new Set(royalties.map((r) => r.period))].slice(0, 3);
  // Split each month into paid vs outstanding so HQ can see collection
  // progress at a glance (green = collected, red = still owed).
  const barData = recentPeriods.map((p) => {
    const rows = royalties.filter((r) => r.period === p);
    const paid = rows.filter((r) => r.status === "paid")
      .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);
    const outstanding = rows.filter((r) => r.status !== "paid")
      .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);
    return { month: monthLabel(p), Paid: paid, Outstanding: outstanding };
  });

  // Per-outlet × per-month grid so HQ can see exactly which outlet
  // paid and which didn't for each of the last 3 months. Iterates
  // REAL outlets (royalties.outlet_id uses real UUIDs); falls back
  // to mockOutlets only while the real list is still loading.
  const gridOutlets = realOutlets.length > 0 ? realOutlets : mockOutlets;
  const collectionGrid = gridOutlets.map((o) => {
    const row: {
      outlet: typeof o;
      cells: { period: string; status: "paid" | "unpaid" | "none"; amount: number }[];
    } = { outlet: o, cells: [] };
    for (const p of recentPeriods) {
      const r = royalties.find((x) => x.outlet_id === o.id && x.period === p);
      if (!r) row.cells.push({ period: p, status: "none", amount: 0 });
      else row.cells.push({
        period: p,
        status: r.status === "paid" ? "paid" : "unpaid",
        amount: r.royalty_amount + r.marketing_fee,
      });
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi href="/admin/sales"       label="Monthly sales"       value={RM(totalSales)}                sub={`${Math.round((totalSales/totalTarget)*100)}% of RM ${totalTarget.toLocaleString()} target`} />
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
            <span className="inline-flex items-center gap-2"><Trophy size={16} className="text-[color:var(--color-brand)]"/> Top 3 sales performers</span>
          </CardTitle>
          <CardSubtitle>Ranked by % of this month&apos;s sales target achieved (actual ÷ target).</CardSubtitle>
          <div className="mt-6 flex items-end justify-center gap-4">
            {[top[1], top[0], top[2]].map((p, i) => (
              <div key={p.outlet.id} className="flex w-28 flex-col items-center">
                <div
                  className="flex w-full items-end justify-center rounded-t-xl bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)] font-bold"
                  style={{ height: [90, 130, 70][i] }}
                >
                  <span className="pb-2 text-lg">{i === 1 ? "🥇" : i === 0 ? "🥈" : "🥉"}</span>
                </div>
                <div className="mt-2 text-center text-[12px] font-semibold">{p.outlet.outlet_code}</div>
                <div className="text-[14px] font-bold text-[color:var(--color-brand-700)]">{Math.round(p.pct)}%</div>
                <div className="text-[10px] text-[color:var(--color-ink-soft)]">of sales target</div>
                <div className="mt-1 text-[10px] text-[color:var(--color-ink-soft)]">
                  RM {p.outlet.monthly_actual.toLocaleString()} / RM {p.outlet.monthly_target.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2"><AlertTriangle size={16} className="text-[color:var(--color-warning)]"/> Needs attention</span>
          </CardTitle>
          <CardSubtitle>Not shame — just where HQ should focus.</CardSubtitle>
          {bottom.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-[color:var(--color-border)] bg-white px-3 py-6 text-center text-[13px] text-[color:var(--color-ink-soft)]">
              All outlets are on track this month. Nothing to action.
            </div>
          )}
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
          onConfirm={async ({ summary, body, when }) => {
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
              body,
              link: target.kind === "coach" ? "/portal/calendar" : "/portal",
              scheduled_at: target.kind === "coach" && when ? when : undefined,
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <CardTitle>Royalty collection — last 3 months</CardTitle>
            <CardSubtitle>Green = paid · Red = still owed, per outlet per month.</CardSubtitle>
          </div>
          {(() => {
            const paid = barData.reduce((s, m) => s + m.Paid, 0);
            const owed = barData.reduce((s, m) => s + m.Outstanding, 0);
            return (
              <div className="flex gap-3 text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]" />
                  <span className="text-[color:var(--color-ink-soft)]">Paid</span>
                  <span className="font-semibold">RM {paid.toLocaleString()}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-danger)]" />
                  <span className="text-[color:var(--color-ink-soft)]">Outstanding</span>
                  <span className="font-semibold">RM {owed.toLocaleString()}</span>
                </span>
              </div>
            );
          })()}
        </div>

        {/* Per-outlet collection grid */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                <th className="px-3 py-2">Outlet</th>
                {recentPeriods.map((p) => (
                  <th key={p} className="px-3 py-2">{monthLabel(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collectionGrid.map(({ outlet, cells }) => (
                <tr key={outlet.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{outlet.outlet_code}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{outlet.location}</div>
                  </td>
                  {cells.map((c) => (
                    <td key={c.period} className="px-3 py-2">
                      {c.status === "none" ? (
                        <span className="text-[11px] text-[color:var(--color-ink-soft)]">—</span>
                      ) : c.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-success)]">
                          ✓ Paid · RM {c.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-danger)]">
                          ✗ Unpaid · RM {c.amount.toLocaleString()}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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

