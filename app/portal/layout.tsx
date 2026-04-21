"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { OutletProvider, useCurrentOutlet, useAuthGuard } from "@/lib/current-outlet";
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

function AuthedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, ready } = useAuthGuard();
  const isLoginRoute = pathname === "/portal/login";

  useEffect(() => {
    if (ready && !authenticated && !isLoginRoute) {
      router.replace("/portal/login");
    }
  }, [ready, authenticated, isLoginRoute, router]);

  // Login route bypasses the shell entirely.
  if (isLoginRoute) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-background)]">
        <div className="skeleton h-12 w-40" />
      </div>
    );
  }
  if (!authenticated) return null;

  return <PortalShell>{children}</PortalShell>;
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const { outlet, franchisee, logout } = useCurrentOutlet();
  const router = useRouter();
  const toast = useToast();

  const handleLogout = () => {
    logout();
    toast("info", "Signed out. See you soon!");
    router.replace("/portal/login");
  };

  return (
    <Shell
      nav={nav}
      title={`Hi, ${franchisee.owner_name.split(" ")[0]} 👋`}
      subtitle={`${outlet.outlet_code} · ${outlet.location}`}
      headerRight={
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium">
            <Store size={14} className="text-[color:var(--color-brand)]" />
            {outlet.outlet_code}
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

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <OutletProvider>
      <AuthedShell>{children}</AuthedShell>
    </OutletProvider>
  );
}
