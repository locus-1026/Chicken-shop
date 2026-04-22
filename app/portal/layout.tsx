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
    const today = new Date().toISOString().slice(0, 10);
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

    // Support alert: tickets in_progress that the franchisee hasn't "seen" since
    // an HQ reply. Simpler heuristic: count tickets where status = 'in_progress'
    // or latest message is from HQ. For now, count in_progress tickets.
    const inProgress = ((tickets ?? []) as { status: string }[]).filter((t) => t.status === "in_progress").length;
    setSupportAlert(inProgress);

    // News alert: announcements not yet read.
    const readIds = new Set(((reads ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id));
    setNewsAlert(((anns ?? []) as { id: string }[]).filter((a) => !readIds.has(a.id)).length);
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
      .subscribe();
    // Also listen for the "supplies page visited" custom event so the badge
    // clears the instant the franchisee opens the page.
    const onSuppliesSeen = () => recompute();
    window.addEventListener("cc.supplies-seen", onSuppliesSeen);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("cc.supplies-seen", onSuppliesSeen);
    };
  }, [recompute, supabase, profile?.id]);

  const nav = useMemo(
    () => [
      { href: "/portal",               label: "Home",       icon: <LayoutDashboard size={18} /> },
      { href: "/portal/sales",         label: "Sales",      icon: <Receipt size={18} /> },
      { href: "/portal/royalty",       label: "Royalty",    icon: <Wallet size={18} />, badge: royaltyAlert },
      { href: "/portal/supplies",      label: "Supplies",   icon: <ShoppingBasket size={18} />, badge: supplyAlert },
      { href: "/portal/training",      label: "Training",   icon: <GraduationCap size={18} /> },
      { href: "/portal/compliance",    label: "Audits",     icon: <ShieldCheck size={18} /> },
      { href: "/portal/marketing",     label: "Marketing",  icon: <ImageIcon size={18} /> },
      { href: "/portal/support",       label: "Help",       icon: <LifeBuoy size={18} />, badge: supportAlert },
      { href: "/portal/announcements", label: "News",       icon: <Megaphone size={18} />, badge: newsAlert },
    ],
    [royaltyAlert, supplyAlert, supportAlert, newsAlert]
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
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-background)]">
      <div className="skeleton h-12 w-40" />
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
