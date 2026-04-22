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
  LogOut,
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-background)]">
        <div className="skeleton h-12 w-40" />
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

  // Live pending-work counts for the sidebar. Refreshes instantly via Supabase
  // Realtime when a franchisee submits something new. Counts represent "items
  // HQ still needs to action" — not a notification that's cleared by clicking.
  const [pendingSales, setPendingSales] = useState(0);        // sales reports submitted today
  const [pendingSupplies, setPendingSupplies] = useState(0);  // orders in "submitted" status
  const [pendingRoyalties, setPendingRoyalties] = useState(0); // proofs awaiting verification

  useEffect(() => {
    if (profile?.role !== "admin") return;
    const supabase = createSupabaseBrowserClient();

    const recompute = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: salesCount }, { count: supplyCount }, { data: proofRows }] = await Promise.all([
        supabase
          .from("sales_reports")
          .select("id", { count: "exact", head: true })
          .eq("report_date", today),
        supabase
          .from("supply_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
        supabase
          .from("royalty_proofs")
          .select("id, verified_at, rejected_at"),
      ]);
      setPendingSales(salesCount ?? 0);
      setPendingSupplies(supplyCount ?? 0);
      const pending = (proofRows ?? []).filter(
        (p: { verified_at: string | null; rejected_at: string | null }) => !p.verified_at && !p.rejected_at
      ).length;
      setPendingRoyalties(pending);
    };

    recompute();

    // Realtime subscriptions — fire recompute whenever any of these tables change.
    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_orders" }, recompute)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalty_proofs" }, recompute)
      .subscribe();

    // Fallback poll in case Realtime isn't enabled on a table yet.
    const id = setInterval(recompute, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [profile?.role]);

  const nav = useMemo(
    () => [
      { href: "/admin/dashboard",     label: "War Room",     icon: <LayoutDashboard size={18} /> },
      { href: "/admin/sales",         label: "Daily sales",  icon: <TrendingUp size={18} />, badge: pendingSales },
      { href: "/admin/franchisees",   label: "Franchisees",  icon: <Users size={18} /> },
      { href: "/admin/royalties",     label: "Royalties",    icon: <Receipt size={18} />, badge: pendingRoyalties },
      { href: "/admin/supplies",      label: "Supplies",     icon: <Package size={18} />, badge: pendingSupplies },
      { href: "/admin/audits",        label: "Audits",       icon: <ShieldCheck size={18} /> },
      { href: "/admin/training",      label: "Training",     icon: <GraduationCap size={18} /> },
      { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
    ],
    [pendingSales, pendingSupplies, pendingRoyalties]
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
      subtitle="Coco Chick Sdn Bhd · 5 active outlets"
      headerRight={
        <div className="flex items-center gap-2">
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
