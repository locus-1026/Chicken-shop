"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
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

const nav = [
  { href: "/admin/dashboard",     label: "War Room",     icon: <LayoutDashboard size={18} /> },
  { href: "/admin/sales",         label: "Daily sales",  icon: <TrendingUp size={18} /> },
  { href: "/admin/franchisees",   label: "Franchisees",  icon: <Users size={18} /> },
  { href: "/admin/royalties",     label: "Royalties",    icon: <Receipt size={18} /> },
  { href: "/admin/supplies",      label: "Supplies",     icon: <Package size={18} /> },
  { href: "/admin/audits",        label: "Audits",       icon: <ShieldCheck size={18} /> },
  { href: "/admin/training",      label: "Training",     icon: <GraduationCap size={18} /> },
  { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
];

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
