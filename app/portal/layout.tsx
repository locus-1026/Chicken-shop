"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { OutletProvider, useOutletState } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  LayoutDashboard,
  Receipt,
  GraduationCap,
  ShieldCheck,
  Megaphone,
  Image as ImageIcon,
  LifeBuoy,
  ShoppingBasket,
  Wallet,
  LogOut,
  Store,
  Bell,
  Calendar as CalendarIcon,
} from "lucide-react";

function Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, ready } = useAuth();
  const isLogin = pathname === "/portal/login";

  useEffect(() => {
    if (!ready) return;
    if (!session && !isLogin) {
      router.replace("/portal/login");
    } else if (session && profile && profile.role !== "franchisee" && !isLogin) {
      // Admin or regional_manager shouldn't be in the franchisee portal.
      router.replace(profile.role === "admin" ? "/admin/dashboard" : "/");
    }
  }, [ready, session, profile, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) return <CenteredSkeleton />;
  if (!session || !profile || profile.role !== "franchisee") return null;

  return (
    <OutletProvider franchiseeId={profile.franchisee_id}>
      <PortalShell>{children}</PortalShell>
    </OutletProvider>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const { outlet, franchisee, outlets, setOutletId } = useOutletState();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Mark the <body> with cc-portal so globals.css can re-skin cards
  // into the softer portal style (#6).
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("cc-portal");
    document.body.classList.remove("cc-admin");
    return () => { document.body.classList.remove("cc-portal"); };
  }, []);

  // Direct-push notifications from HQ. Realtime row-insert → toast on screen.
  // Count unread for a header bell badge.
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => {
    if (!profile?.id) return;
    const refresh = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", profile.id)
        .is("read_at", null);
      setUnreadNotifications(count ?? 0);
    };
    refresh();
    const channel = supabase
      .channel("portal-notifications-" + profile.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as { title: string; body: string };
          toast("info", `${n.title} — ${n.body}`);
          setUnreadNotifications((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` },
        refresh
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, profile?.id, toast]);

  // Sidebar notifications for the franchisee:
  //  • Royalty badge  — proofs rejected by HQ or statements overdue & unpaid
  //  • Supplies badge — orders with newly-confirmed/shipped/delivered status
  //                     since last visit (localStorage watermark per outlet)
  //  • Support badge  — tickets with HQ replies the user hasn't opened yet
  //  • News badge     — announcements the user hasn't read
  const [royaltyAlert, setRoyaltyAlert] = useState(0);
  const [supplyAlert, setSupplyAlert] = useState(0);
  const [supportAlert, setSupportAlert] = useState(0);
  const [newsAlert, setNewsAlert] = useState(0);
  const [salesAlert, setSalesAlert] = useState(0); // 1 if today's sales not yet submitted
  const [trainingAlert, setTrainingAlert] = useState(0); // # modules still to complete
  const [calendarAlert, setCalendarAlert] = useState(0); // today's upcoming events (from now)

  const recompute = useCallback(async () => {
    if (!outlet || !profile?.id) return;
    const [
      { data: roys },
      { data: orders },
      { data: tickets },
      { data: anns },
      { data: reads },
    ] = await Promise.all([
      supabase
        .from("royalties")
        .select("id, status, due_date")
        .eq("outlet_id", outlet.id),
      supabase
        .from("supply_orders")
        .select("id, status, submitted_at, delivered_at")
        .eq("outlet_id", outlet.id)
        .neq("status", "submitted")
        .neq("status", "cancelled"),
      supabase
        .from("support_tickets")
        .select("id, status, created_at")
        .eq("outlet_id", outlet.id),
      supabase
        .from("announcements")
        .select("id"),
      supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", profile.id),
    ]);

    // Royalty alert: rejected proofs OR overdue unpaid statements
    // Local YYYY-MM-DD — UTC from toISOString can be yesterday in GMT+8,
    // which makes the calendar badge disagree with the calendar page.
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
    const unpaidOverdue = ((roys ?? []) as { id: string; status: string; due_date: string }[])
      .filter((r) => r.status !== "paid" && r.due_date < today).length;
    const { data: rejectedProofs } = await supabase
      .from("royalty_proofs")
      .select("id, rejected_at, royalty_id")
      .in("royalty_id", ((roys ?? []) as { id: string }[]).map((r) => r.id));
    const rejectedCount = ((rejectedProofs ?? []) as { rejected_at: string | null }[])
      .filter((p) => p.rejected_at).length;
    setRoyaltyAlert(unpaidOverdue + rejectedCount);

    // Supplies alert: only count orders whose latest activity (submitted or
    // delivered) happened AFTER the franchisee last opened /portal/supplies.
    // Once they visit the page we bump the watermark forward and the badge
    // clears — matches how /portal/announcements clears News via announcement_reads.
    const lastSeenRaw = typeof window !== "undefined"
      ? window.localStorage.getItem("cc.portal.supplies.lastSeen." + outlet.id)
      : null;
    const lastSeen = lastSeenRaw ?? "1970-01-01";
    const newish = ((orders ?? []) as { submitted_at: string; delivered_at: string | null }[])
      .filter((o) => {
        const latest = o.delivered_at ?? o.submitted_at;
        return latest > lastSeen;
      });
    setSupplyAlert(newish.length);

    // Support alert: count in_progress tickets where the LATEST HQ reply (or
    // the ticket itself) happened after the franchisee last opened /portal/support.
    // Visiting the page bumps the watermark forward, so the badge clears.
    const supportSeenRaw = typeof window !== "undefined"
      ? window.localStorage.getItem("cc.portal.support.lastSeen." + outlet.id)
      : null;
    const supportSeen = supportSeenRaw ?? "1970-01-01";
    const ticketRows = (tickets ?? []) as { id: string; status: string; created_at: string }[];
    const inProgressTickets = ticketRows.filter((t) => t.status === "in_progress");
    let supportCount = 0;
    if (inProgressTickets.length > 0) {
      // Pull latest HQ message per ticket so the badge only lights on actual
      // activity the franchisee hasn't seen.
      const { data: hqMessages } = await supabase
        .from("ticket_messages")
        .select("ticket_id, created_at")
        .in("ticket_id", inProgressTickets.map((t) => t.id))
        .eq("author", "hq")
        .order("created_at", { ascending: false });
      const latestByTicket: Record<string, string> = {};
      for (const m of (hqMessages ?? []) as { ticket_id: string; created_at: string }[]) {
        if (!latestByTicket[m.ticket_id]) latestByTicket[m.ticket_id] = m.created_at;
      }
      supportCount = inProgressTickets.filter((t) => {
        const latest = latestByTicket[t.id] ?? t.created_at;
        return latest > supportSeen;
      }).length;
    }
    setSupportAlert(supportCount);

    // News alert: unread announcements + direct HQ notifications that still
    // need action. Actionable notifications (coaching, notices, nudges) only
    // clear when the franchisee clicks a response button — matches bell logic.
    const readIds = new Set(((reads ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id));
    const unreadAnns = ((anns ?? []) as { id: string }[]).filter((a) => !readIds.has(a.id)).length;
    const { data: pendingNotifs } = await supabase
      .from("notifications")
      .select("id, kind, read_at, responded_at")
      .eq("recipient_id", profile.id)
      .is("read_at", null);
    setNewsAlert(unreadAnns + (pendingNotifs?.length ?? 0));

    // Sales alert: action needed if today's sales report hasn't been
    // submitted for this outlet yet. Badge drops to 0 the moment the
    // franchisee submits today's numbers on /portal/sales.
    const { count: todaySales } = await supabase
      .from("sales_reports")
      .select("id", { count: "exact", head: true })
      .eq("outlet_id", outlet.id)
      .eq("report_date", today);
    setSalesAlert((todaySales ?? 0) === 0 ? 1 : 0);

    // Training alert: modules not yet marked complete for this user.
    // Badge drops as each module is finished on /portal/training.
    const [{ data: mods }, { data: prog }] = await Promise.all([
      supabase.from("training_modules").select("id"),
      supabase.from("training_progress").select("module_id, completed_at").eq("user_id", profile.id),
    ]);
    const completedSet = new Set(
      ((prog ?? []) as { module_id: string; completed_at: string | null }[])
        .filter((p) => !!p.completed_at)
        .map((p) => p.module_id)
    );
    const totalMods = ((mods ?? []) as { id: string }[]).length;
    const completedCount = ((mods ?? []) as { id: string }[]).filter((m) => completedSet.has(m.id)).length;
    setTrainingAlert(Math.max(0, totalMods - completedCount));

    // Calendar alert: every upcoming coaching call for this franchisee
    // (scheduled date today or later — compared as YYYY-MM-DD so timezones
    // don't drop events) + royalties due today still unpaid. Matches the
    // calendar page's "upcoming" dots on the week strip.
    const { data: allCoaching } = await supabase
      .from("notifications")
      .select("id, scheduled_at")
      .eq("recipient_id", profile.id)
      .eq("kind", "coaching_call")
      .not("scheduled_at", "is", null);
    const upcomingCoaching = ((allCoaching ?? []) as { scheduled_at: string }[])
      .filter((c) => c.scheduled_at.slice(0, 10) >= today).length;
    const { data: upRoyalties } = await supabase
      .from("royalties")
      .select("id")
      .eq("outlet_id", outlet.id)
      .neq("status", "paid")
      .eq("due_date", today);
    setCalendarAlert(upcomingCoaching + (upRoyalties?.length ?? 0));
  }, [supabase, outlet, profile?.id]);

  useEffect(() => {
    recompute();
    if (!profile?.id) return;
    const channel = supabase
      .channel("portal-badges-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalties" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalty_proofs" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_orders" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_reads" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_progress", filter: `user_id=eq.${profile.id}` }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "training_modules" }, recompute)
      .subscribe();
    // Also listen for "page visited" custom events so badges clear the instant
    // the franchisee opens the relevant page.
    const onSeen = () => recompute();
    window.addEventListener("cc.supplies-seen", onSeen);
    window.addEventListener("cc.support-seen", onSeen);
    // Tick every 60s so the calendar badge drops as scheduled times pass
    // (e.g. a 2pm call stops counting at 2:01pm).
    const tick = setInterval(recompute, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("cc.supplies-seen", onSeen);
      window.removeEventListener("cc.support-seen", onSeen);
      clearInterval(tick);
    };
  }, [recompute, supabase, profile?.id]);

  const nav = useMemo(
    () => [
      { href: "/portal",               label: "Home",       icon: <LayoutDashboard size={18} /> },
      { href: "/portal/calendar",      label: "Calendar",   icon: <CalendarIcon size={18} />, badge: calendarAlert },
      { href: "/portal/sales",         label: "Sales",      icon: <Receipt size={18} />, badge: salesAlert },
      { href: "/portal/royalty",       label: "Royalty",    icon: <Wallet size={18} />, badge: royaltyAlert },
      { href: "/portal/supplies",      label: "Supplies",   icon: <ShoppingBasket size={18} />, badge: supplyAlert },
      { href: "/portal/training",      label: "Training",   icon: <GraduationCap size={18} />, badge: trainingAlert },
      { href: "/portal/compliance",    label: "Audits",     icon: <ShieldCheck size={18} /> },
      { href: "/portal/marketing",     label: "Marketing",  icon: <ImageIcon size={18} /> },
      { href: "/portal/support",       label: "Help",       icon: <LifeBuoy size={18} />, badge: supportAlert },
      { href: "/portal/announcements", label: "News",       icon: <Megaphone size={18} />, badge: newsAlert },
    ],
    [royaltyAlert, supplyAlert, supportAlert, newsAlert, salesAlert, trainingAlert, calendarAlert]
  );

  if (!outlet || !franchisee) {
    return <CenteredSkeleton />;
  }

  const handleLogout = async () => {
    await signOut();
    toast("info", "Signed out.");
    router.replace("/portal/login");
  };

  return (
    <Shell
      nav={nav}
      title={`Hi, ${franchisee.owner_name.split(" ")[0]} 👋`}
      subtitle={`${outlet.outlet_code} · ${outlet.location}`}
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/portal/announcements")}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand-700)]"
            aria-label="Open notifications"
            title={unreadNotifications > 0 ? `${unreadNotifications} unread HQ notifications — click to view` : "View notifications"}
          >
            <Bell size={16} />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1 text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
          {outlets.length > 1 ? (
            <select
              value={outlet.id}
              onChange={(e) => setOutletId(e.target.value)}
              className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.outlet_code} · {o.state}</option>
              ))}
            </select>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium">
              <Store size={14} className="text-[color:var(--color-brand)]" />
              {outlet.outlet_code}
            </span>
          )}
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

function CenteredSkeleton() {
  // Portal loading (#12) — branded splash instead of a bare bar. Sets a
  // warmer tone than the admin dashboard-skeleton and reassures the
  // franchisee their account is loading, not broken.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--color-background)] px-6 text-center">
      <img
        src="/brand/logo.png"
        alt="JI FAN WANG"
        className="h-20 w-20 object-contain animate-pulse"
      />
      <div>
        <div className="text-[16px] font-semibold tracking-tight text-[color:var(--color-ink)]">JI FAN WANG · 鸡饭王</div>
        <div className="text-[12px] text-[color:var(--color-ink-soft)]">Getting your outlet ready…</div>
      </div>
      <div className="skeleton mt-2 h-1.5 w-40 rounded-full" />
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
