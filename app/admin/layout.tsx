"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ShieldCheck,
  GraduationCap,
  Megaphone,
  Package,
  TrendingUp,
  LifeBuoy,
  LogOut,
  Calendar as CalendarIcon,
  Bell,
  Building2,
} from "lucide-react";

function Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, ready } = useAuth();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (!ready) return;
    if (!session && !isLogin) {
      router.replace("/admin/login");
    } else if (session && profile && profile.role !== "admin" && !isLogin) {
      router.replace(profile.role === "franchisee" ? "/portal" : "/");
    }
  }, [ready, session, profile, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) {
    // Admin loading = BI-dashboard skeleton grid (matches the War Room
    // feel) instead of a centered spinner. Makes it immediately clear
    // that a dense dashboard is loading, not a friendly portal.
    return (
      <div className="flex min-h-screen bg-[color:var(--color-background)] p-5 lg:p-10">
        <div className="hidden lg:block w-64 shrink-0 border-r border-[color:var(--color-border)] pr-5">
          <div className="skeleton mb-4 h-9 w-36" />
          <div className="space-y-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-9 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 lg:pl-10 space-y-5">
          <div className="skeleton h-7 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[92px] w-full" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-[220px] w-full" />
            ))}
          </div>
          <div className="skeleton h-[320px] w-full" />
        </div>
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;

  return <AdminShell>{children}</AdminShell>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  // Live outlet count for the header chip so "5 outlets · MY" is truth
  // rather than a hard-coded string.
  const [outletCount, setOutletCount] = useState<number | null>(null);

  // Mark the <body> with cc-admin so globals.css can re-skin cards into
  // the flatter admin dashboard style (#6). Removed on unmount so the
  // portal view isn't affected if the admin signs out.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("cc-admin");
    document.body.classList.remove("cc-portal");
    return () => { document.body.classList.remove("cc-admin"); };
  }, []);

  // Live pending-work counts for the sidebar. Refreshes instantly via Supabase
  // Realtime when a franchisee submits something new. Counts represent "items
  // HQ still needs to action" — not a notification that's cleared by clicking.
  const [pendingSales, setPendingSales] = useState(0);        // sales reports submitted today
  const [pendingSupplies, setPendingSupplies] = useState(0);  // orders in "submitted" status
  const [pendingRoyalties, setPendingRoyalties] = useState(0); // proofs awaiting verification
  const [openTickets, setOpenTickets] = useState(0);           // open+in_progress tickets
  const [atRiskAudits, setAtRiskAudits] = useState(0);         // risk-flagged audits
  const [calendarAlert, setCalendarAlert] = useState(0);       // today's upcoming events (from now)

  useEffect(() => {
    if (profile?.role !== "admin") return;
    const supabase = createSupabaseBrowserClient();

    const recompute = async () => {
      // Local YYYY-MM-DD — toISOString gives UTC which in GMT+8 can be the
      // previous calendar day. The calendar page uses local date for its
      // "Upcoming coaching" KPI so the badge must match to stay in sync.
      const _d = new Date();
      const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
      const salesSeenRaw = typeof window !== "undefined"
        ? window.localStorage.getItem("cc.admin.sales.lastSeen") : null;
      const salesSeen = salesSeenRaw ?? "1970-01-01";
      const supportSeenRaw = typeof window !== "undefined"
        ? window.localStorage.getItem("cc.admin.support.lastSeen") : null;
      const supportSeen = supportSeenRaw ?? "1970-01-01";

      const [
        { data: salesRows },
        { count: supplyCount },
        { data: proofRows },
        { data: ticketRows },
        { data: auditRows },
        { data: outletRows },
        { count: unpaidRoyalties },
      ] = await Promise.all([
        supabase
          .from("sales_reports")
          .select("report_date, id, outlet_id")
          .eq("report_date", today),
        supabase
          .from("supply_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
        supabase
          .from("royalty_proofs")
          .select("id, verified_at, rejected_at, submitted_at"),
        supabase
          .from("support_tickets")
          .select("id, status, created_at")
          .in("status", ["open", "in_progress"]),
        supabase
          .from("compliance_audits")
          .select("outlet_id, audit_date, risk_flag")
          .order("audit_date", { ascending: false }),
        supabase
          .from("outlets")
          .select("id, opening_date"),
        supabase
          .from("royalties")
          .select("id", { count: "exact", head: true })
          .neq("status", "paid"),
      ]);
      // Sales badge: number of active outlets that have NOT yet submitted
      // today. Matches the "NEEDS ACTION" cards on /admin/sales.
      const submittedOutletIds = new Set(
        ((salesRows ?? []) as { outlet_id: string }[]).map((r) => r.outlet_id)
      );
      const activeOutlets = (outletRows ?? []) as { id: string }[];
      setOutletCount(activeOutlets.length);
      const pendingOutlets = activeOutlets.filter((o) => !submittedOutletIds.has(o.id)).length;
      setPendingSales(pendingOutlets);
      void salesSeen; // no longer used; kept in scope for future diff-based UX
      setPendingSupplies(supplyCount ?? 0);
      // Royalty badge: every royalty still needing HQ action — either the
      // statement isn't paid yet, OR a proof has been uploaded and is
      // awaiting verification. Matches what shows on /admin/royalties.
      const awaitingVerification = (proofRows ?? []).filter(
        (p: { verified_at: string | null; rejected_at: string | null }) => !p.verified_at && !p.rejected_at
      ).length;
      // `unpaidRoyalties` already includes rows with pending proofs, so use
      // max() to avoid double-counting the same statement.
      setPendingRoyalties(Math.max(unpaidRoyalties ?? 0, awaitingVerification));
      // Help badge: every ticket not yet resolved (open + in_progress).
      // Stays visible until HQ marks the ticket resolved — mirrors the
      // "Open" and "In progress" KPIs on /admin/support.
      const openIds = ((ticketRows ?? []) as { id: string; created_at: string }[]);
      setOpenTickets(openIds.length);
      void supportSeen; // watermark no longer used for this badge
      // Audits badge: count outlets that need HQ action — past the
      // 30-day audit window, or never audited at all. Also bump for any
      // at-risk outlets (two sub-80 scores). Matches 'Needs action' KPI
      // on /admin/audits so the sidebar agrees with the page.
      const auditList = (auditRows ?? []) as { outlet_id: string; audit_date: string; risk_flag: boolean }[];
      const outletAuditList = (outletRows ?? []) as { id: string; opening_date: string | null }[];
      const latestByOutlet: Record<string, string> = {};
      for (const a of auditList) {
        if (!latestByOutlet[a.outlet_id]) latestByOutlet[a.outlet_id] = a.audit_date;
      }
      const AUDIT_CYCLE_MS = 30 * 86_400_000;
      let needsAudit = 0;
      for (const o of outletAuditList) {
        const last = latestByOutlet[o.id];
        if (!last) { needsAudit += 1; continue; } // never audited
        if (Date.now() - new Date(last).getTime() > AUDIT_CYCLE_MS) needsAudit += 1; // overdue
      }
      const riskCount = auditList.filter((a) => a.risk_flag).length;
      setAtRiskAudits(Math.max(needsAudit, riskCount));

      // Calendar alert: mirrors the "Upcoming coaching" KPI on /admin/calendar.
      // Counts every coaching call whose scheduled date is today or later
      // (compared by date-string so timezone quirks don't drop events), plus
      // any royalty statement due today that still isn't paid. Overdue items
      // live in the "Needs action" banner — not counted here.
      const { data: allCoaching } = await supabase
        .from("notifications")
        .select("id, scheduled_at")
        .eq("kind", "coaching_call")
        .not("scheduled_at", "is", null);
      const upcomingCoaching = ((allCoaching ?? []) as { scheduled_at: string }[])
        .filter((c) => c.scheduled_at.slice(0, 10) >= today).length;
      const { data: upRoyalties } = await supabase
        .from("royalties")
        .select("id")
        .neq("status", "paid")
        .eq("due_date", today);
      setCalendarAlert(upcomingCoaching + (upRoyalties?.length ?? 0));
    };

    recompute();

    // Realtime subscriptions — fire recompute whenever any of these tables change.
    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_orders" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalty_proofs" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalties" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "compliance_audits" }, recompute)
      .subscribe();

    // Watermark clear events — fire when admin opens the corresponding page.
    const onSeen = () => recompute();
    window.addEventListener("cc.admin.sales-seen", onSeen);
    window.addEventListener("cc.admin.support-seen", onSeen);
    // Calendar "Resolved" button on /admin/calendar dispatches this — lets
    // the sidebar badge drop instantly instead of waiting for the 30s poll.
    window.addEventListener("cc.admin.calendar-resolved", onSeen);

    // Fallback poll in case Realtime isn't enabled on a table yet. Also
    // keeps `calendarAlert` fresh so past coaching times stop counting.
    const id = setInterval(recompute, 30000);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("cc.admin.sales-seen", onSeen);
      window.removeEventListener("cc.admin.support-seen", onSeen);
      window.removeEventListener("cc.admin.calendar-resolved", onSeen);
      clearInterval(id);
    };
  }, [profile?.role]);

  const nav = useMemo(
    () => [
      { href: "/admin/dashboard",     label: "War Room",     icon: <LayoutDashboard size={18} /> },
      { href: "/admin/calendar",      label: "Calendar",     icon: <CalendarIcon size={18} />, badge: calendarAlert },
      { href: "/admin/sales",         label: "Daily sales",  icon: <TrendingUp size={18} />, badge: pendingSales },
      { href: "/admin/franchisees",   label: "Franchisees",  icon: <Users size={18} /> },
      { href: "/admin/royalties",     label: "Royalties",    icon: <Receipt size={18} />, badge: pendingRoyalties },
      { href: "/admin/supplies",      label: "Supplies",     icon: <Package size={18} />, badge: pendingSupplies },
      { href: "/admin/audits",        label: "Audits",       icon: <ShieldCheck size={18} />, badge: atRiskAudits },
      { href: "/admin/support",       label: "Help",         icon: <LifeBuoy size={18} />, badge: openTickets },
      { href: "/admin/training",      label: "Training",     icon: <GraduationCap size={18} /> },
      { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
    ],
    [pendingSales, pendingSupplies, pendingRoyalties, atRiskAudits, openTickets, calendarAlert]
  );

  // Silence unused-variable lint for `pathname` — it's here so future badge
  // logic can distinguish between "you're currently on this tab" vs not.
  void pathname;

  const handleLogout = async () => {
    await signOut();
    toast("info", "Signed out of HQ.");
    router.replace("/admin/login");
  };

  return (
    <Shell
      nav={nav}
      title="HQ Admin"
      subtitle={`Coco Chick Sdn Bhd · ${outletCount ?? "—"} active outlet${outletCount === 1 ? "" : "s"}`}
      headerRight={
        <div className="flex items-center gap-2">
          {/* Identity lockup (#3): a shield "HQ" monogram + permanent
              HQ ADMIN chip with a live outlet count so the page always
              announces "you're in the command deck, not the portal". */}
          <span className="hidden lg:inline-flex items-center gap-2 rounded-full border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
            <ShieldCheck size={12} /> HQ Admin
          </span>
          <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-ink-soft)]">
            <Building2 size={11} />
            {outletCount ?? "—"} outlet{outletCount === 1 ? "" : "s"} · MY
          </span>
          {/* Quick link to the Help inbox — badge mirrors the sidebar
              "Help" count so HQ can jump to open tickets from any page. */}
          <button
            onClick={() => router.push("/admin/support")}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand-700)]"
            aria-label="Open support tickets"
            title={openTickets > 0 ? `${openTickets} open ticket${openTickets === 1 ? "" : "s"} — click to view` : "View support tickets"}
          >
            <Bell size={16} />
            {openTickets > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1 text-[10px] font-bold text-white">
                {openTickets > 9 ? "9+" : openTickets}
              </span>
            )}
          </button>
          <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium">
            {profile?.email}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      }
    >
      {children}
    </Shell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
