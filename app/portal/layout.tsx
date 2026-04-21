"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { OutletProvider, useOutletState } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
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

const nav = [
  { href: "/portal",               label: "Home",       icon: <LayoutDashboard size={18} /> },
  { href: "/portal/sales",         label: "Sales",      icon: <Receipt size={18} /> },
  { href: "/portal/royalty",       label: "Royalty",    icon: <Wallet size={18} /> },
  { href: "/portal/supplies",      label: "Supplies",   icon: <ShoppingBasket size={18} /> },
  { href: "/portal/training",      label: "Training",   icon: <GraduationCap size={18} /> },
  { href: "/portal/compliance",    label: "Audits",     icon: <ShieldCheck size={18} /> },
  { href: "/portal/marketing",     label: "Marketing",  icon: <ImageIcon size={18} /> },
  { href: "/portal/support",       label: "Support",    icon: <LifeBuoy size={18} /> },
  { href: "/portal/announcements", label: "News",       icon: <Megaphone size={18} /> },
];

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
  const { signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();

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
