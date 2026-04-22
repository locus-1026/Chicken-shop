"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SalesReport, Outlet, Franchisee } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RM, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  Clock,
  Check,
  AlertCircle,
  Bell,
  Download,
  Search,
  Utensils,
  ShoppingBag,
  Bike,
} from "lucide-react";

function channelTop(mix: SalesReport["channel_mix"]) {
  if (!mix) return "—";
  const entries = Object.entries(mix) as Array<[keyof NonNullable<SalesReport["channel_mix"]>, number]>;
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  const label = top[0] === "dine_in" ? "Dine-in" : top[0] === "takeaway" ? "Takeaway" : "Delivery";
  return `${label} ${top[1]}%`;
}

export default function AdminSalesPage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filterOutlet, setFilterOutlet] = useState<"all" | string>("all");
  const [allReports, setAllReports] = useState<SalesReport[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);

  // Pull every sales report across every outlet (RLS allows admin to see all).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const load = async () => {
      const [{ data: reports, error }, { data: outletData }, { data: franchiseeData }] = await Promise.all([
        supabase
          .from("sales_reports")
          .select("id, outlet_id, report_date, gross_sales, transactions, notes, channel_mix, beverage_pct")
          .order("report_date", { ascending: false })
          .limit(500),
        supabase.from("outlets").select("*").order("outlet_code"),
        supabase.from("franchisees").select("*"),
      ]);
      if (error) {
        toast("error", `Couldn't load sales: ${error.message}`);
        return;
      }
      setAllReports((reports ?? []) as SalesReport[]);
      setOutlets((outletData ?? []) as Outlet[]);
      setFranchisees((franchiseeData ?? []) as Franchisee[]);
    };
    load();
    const channel = supabase
      .channel("admin-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, load)
      .subscribe();
    const id = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [toast]);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  // Per-outlet: today's submission + last 7-day rollup.
  const perOutlet = useMemo(
    () =>
      outlets.map((o) => {
        const franchisee = franchisees.find((f) => f.id === o.franchisee_id);
        const reports = allReports.filter((r) => r.outlet_id === o.id);
        const todays = reports.find((r) => r.report_date === today);
        const yesterdays = reports.find((r) => r.report_date === yesterday);
        const last7 = [...reports]
          .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
          .slice(0, 7);
        const week = last7.reduce((s, r) => s + r.gross_sales, 0);
        const latest = [...reports].sort((a, b) => (a.report_date < b.report_date ? 1 : -1))[0];
        return { outlet: o, franchisee, todays, yesterdays, latest, week };
      }),
    [today, yesterday, allReports, outlets, franchisees]
  );

  const submittedToday = perOutlet.filter((p) => p.todays).length;
  const missing = perOutlet.filter((p) => !p.todays);
  const totalToday = perOutlet.reduce((s, p) => s + (p.todays?.gross_sales ?? 0), 0);
  const txnToday = perOutlet.reduce((s, p) => s + (p.todays?.transactions ?? 0), 0);

  // Recent submissions across every outlet.
  const recentRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allReports
      .map((r) => {
        const outlet = outlets.find((o) => o.id === r.outlet_id);
        const franchisee = outlet ? franchisees.find((f) => f.id === outlet.franchisee_id) : undefined;
        return { ...r, outlet, franchisee };
      })
      .filter((r) => (filterOutlet === "all" ? true : r.outlet?.id === filterOutlet))
      .filter((r) =>
        q
          ? (r.outlet?.outlet_code ?? "").toLowerCase().includes(q) ||
            (r.outlet?.location ?? "").toLowerCase().includes(q) ||
            (r.franchisee?.owner_name ?? "").toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
      .slice(0, 30);
  }, [query, filterOutlet, allReports, outlets, franchisees]);

  const exportCsv = () => {
    const rows = [
      ["outlet_code", "location", "owner", "date", "gross_sales", "transactions", "avg_ticket", "dine_in_%", "takeaway_%", "delivery_%", "beverage_%"],
      ...recentRows.map((r) => [
        r.outlet?.outlet_code ?? "",
        r.outlet?.location ?? "",
        r.franchisee?.owner_name ?? "",
        r.report_date,
        r.gross_sales,
        r.transactions,
        r.transactions ? Math.round(r.gross_sales / r.transactions) : 0,
        r.channel_mix?.dine_in ?? "",
        r.channel_mix?.takeaway ?? "",
        r.channel_mix?.delivery ?? "",
        r.beverage_pct ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("success", `Exported ${recentRows.length} rows to CSV.`);
  };

  const nudgeMissing = () => {
    if (missing.length === 0) {
      toast("info", "Everyone's already submitted today — no reminders needed.");
      return;
    }
    toast("success", `Reminder WhatsApp sent to ${missing.length} outlet${missing.length > 1 ? "s" : ""}.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Submitted today"
          value={`${submittedToday}/${outlets.length}`}
          sub={submittedToday === outlets.length ? "All outlets in" : `${outlets.length - submittedToday} still pending`}
          tone={submittedToday === outlets.length ? "success" : submittedToday >= outlets.length - 1 ? "warning" : "danger"}
        />
        <Kpi
          label="Group sales today"
          value={RM(totalToday)}
          sub={`${txnToday.toLocaleString()} transactions across the group`}
          tone="brand"
        />
        <Kpi
          label="Group avg ticket"
          value={RM(txnToday ? Math.round(totalToday / txnToday) : 0)}
          sub="Today so far"
        />
        <Kpi
          label="Still pending"
          value={`${missing.length}`}
          sub={missing.length ? "Tap below to nudge them" : "All in — good day"}
          tone={missing.length === 0 ? "success" : missing.length > 2 ? "danger" : "warning"}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-[color:var(--color-brand)]" /> Today's submissions</span>
            </CardTitle>
            <CardSubtitle>Who reported, who hasn't. Tap an outlet for the full profile.</CardSubtitle>
          </div>
          <Button size="sm" variant="outline" onClick={nudgeMissing} disabled={missing.length === 0}>
            <Bell size={14} /> Nudge {missing.length || "none"} missing
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perOutlet.map((p) => {
            const isIn = !!p.todays;
            return (
              <Link key={p.outlet.id} href={`/admin/outlets/${p.outlet.outlet_code}`} className="block">
                <div
                  className={
                    "rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
                    (isIn
                      ? "border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
                      : "border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{p.outlet.outlet_code}</div>
                      <div className="truncate text-[12px] text-[color:var(--color-ink-soft)]">{p.outlet.location}</div>
                      <div className="truncate text-[11px] text-[color:var(--color-ink-soft)]">Owner {p.franchisee?.owner_name ?? "—"}</div>
                    </div>
                    <Pill tone={isIn ? "success" : "warning"}>
                      {isIn ? <><Check size={10} /> In</> : <><Clock size={10} /> Pending</>}
                    </Pill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MiniCell
                      label="Today"
                      value={p.todays ? RM(p.todays.gross_sales) : "—"}
                      highlight={isIn}
                    />
                    <MiniCell
                      label="Txn"
                      value={p.todays ? p.todays.transactions.toString() : "—"}
                    />
                    <MiniCell
                      label="7-day"
                      value={RM(p.week)}
                    />
                  </div>
                  {!isIn && p.latest && (
                    <div className="mt-2 text-[11px] text-[color:var(--color-ink-soft)]">
                      Last reported {formatDate(p.latest.report_date)}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recent submissions</CardTitle>
            <CardSubtitle>Latest 30 rows across every outlet.</CardSubtitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-soft)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Outlet, owner, location…"
                className="w-56 rounded-full border border-[color:var(--color-border)] bg-white py-1.5 pl-8 pr-3 text-sm focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </div>
            <select
              value={filterOutlet}
              onChange={(e) => setFilterOutlet(e.target.value)}
              className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-sm"
            >
              <option value="all">All outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.outlet_code} · {o.state}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download size={14} /> CSV
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Txn</th>
              <th className="px-4 py-3 text-right">Avg ticket</th>
              <th className="px-4 py-3">Top channel</th>
              <th className="px-4 py-3">Beverage</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[color:var(--color-ink-soft)]">
                  No submissions match this filter.
                </td>
              </tr>
            ) : (
              recentRows.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-3 font-medium">{formatDate(r.report_date)}</td>
                  <td className="px-4 py-3">
                    {r.outlet ? (
                      <Link href={`/admin/outlets/${r.outlet.outlet_code}`} className="font-semibold text-[color:var(--color-brand-700)] hover:underline">
                        {r.outlet.outlet_code}
                      </Link>
                    ) : "—"}
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{r.outlet?.location}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px]">{r.franchisee?.owner_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{RM(r.gross_sales)}</td>
                  <td className="px-4 py-3 text-right">{r.transactions}</td>
                  <td className="px-4 py-3 text-right">
                    {r.transactions ? RM(Math.round(r.gross_sales / r.transactions)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    <ChannelIcon mix={r.channel_mix} /> {channelTop(r.channel_mix)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[color:var(--color-ink-soft)]">
                    {r.beverage_pct !== undefined ? `${r.beverage_pct}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {missing.length > 0 && (
        <Card className="!border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <span className="inline-flex items-center gap-2"><AlertCircle size={16} className="text-[color:var(--color-warning)]" /> Still waiting on</span>
              </CardTitle>
              <CardSubtitle>These outlets haven't reported today.</CardSubtitle>
            </div>
            <Button size="sm" variant="outline" onClick={nudgeMissing}>
              <Bell size={14} /> Nudge all
            </Button>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {missing.map((m) => (
              <li key={m.outlet.id}>
                <Link href={`/admin/outlets/${m.outlet.outlet_code}`} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 hover:border-[color:var(--color-brand-200)]">
                  <div>
                    <div className="text-sm font-semibold">{m.outlet.outlet_code} · {m.outlet.location}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">
                      Owner {m.franchisee?.owner_name ?? "—"} · Last in {m.latest ? formatDate(m.latest.report_date) : "never"}
                    </div>
                  </div>
                  <Pill tone="warning">Pending</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "warning" | "danger" | "brand" }) {
  const cls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : "";
  return (
    <Card>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-2 text-[22px] font-semibold " + cls}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
}

function MiniCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-white px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-0.5 text-[13px] font-semibold " + (highlight ? "text-[color:var(--color-success)]" : "")}>{value}</div>
    </div>
  );
}

function ChannelIcon({ mix }: { mix: SalesReport["channel_mix"] }) {
  if (!mix) return null;
  const entries = Object.entries(mix) as Array<[keyof NonNullable<SalesReport["channel_mix"]>, number]>;
  const top = entries.sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === "dine_in")  return <Utensils size={12} className="mr-1 inline -mt-0.5" />;
  if (top === "takeaway") return <ShoppingBag size={12} className="mr-1 inline -mt-0.5" />;
  if (top === "delivery") return <Bike size={12} className="mr-1 inline -mt-0.5" />;
  return null;
}
