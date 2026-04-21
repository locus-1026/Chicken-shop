"use client";

import { Shell } from "@/components/layout/Shell";
import { OutletSwitcher } from "@/components/layout/OutletSwitcher";
import { OutletProvider, useCurrentOutlet } from "@/lib/current-outlet";
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

function PortalShell({ children }: { children: React.ReactNode }) {
  const { outlet, franchisee } = useCurrentOutlet();
  return (
    <Shell
      nav={nav}
      title={`Hi, ${franchisee.owner_name.split(" ")[0]} 👋`}
      subtitle={`${outlet.outlet_code} · ${outlet.location}`}
      headerRight={<OutletSwitcher />}
    >
      {children}
    </Shell>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <OutletProvider>
      <PortalShell>{children}</PortalShell>
    </OutletProvider>
  );
}
