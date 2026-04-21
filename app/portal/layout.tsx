"use client";

import { Shell } from "@/components/layout/Shell";
import {
  LayoutDashboard,
  Receipt,
  GraduationCap,
  ShieldCheck,
  Megaphone,
  Image as ImageIcon,
  LifeBuoy,
} from "lucide-react";
import { mockFranchisees, mockOutlets, DEMO_FRANCHISEE_ID } from "@/lib/mock-data";

const nav = [
  { href: "/portal",               label: "Home",       icon: <LayoutDashboard size={18} /> },
  { href: "/portal/sales",         label: "Sales",      icon: <Receipt size={18} /> },
  { href: "/portal/training",      label: "Training",   icon: <GraduationCap size={18} /> },
  { href: "/portal/compliance",    label: "Audits",     icon: <ShieldCheck size={18} /> },
  { href: "/portal/marketing",     label: "Marketing",  icon: <ImageIcon size={18} /> },
  { href: "/portal/support",       label: "Support",    icon: <LifeBuoy size={18} /> },
  { href: "/portal/announcements", label: "News",       icon: <Megaphone size={18} /> },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const f = mockFranchisees.find((x) => x.id === DEMO_FRANCHISEE_ID)!;
  const o = mockOutlets.find((x) => x.franchisee_id === DEMO_FRANCHISEE_ID)!;
  return (
    <Shell
      nav={nav}
      title={`Hi, ${f.owner_name.split(" ")[0]} 👋`}
      subtitle={`${o.outlet_code} · ${o.location}`}
      headerRight={
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-[color:var(--color-brand-50)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-700)]">
          {f.business_name}
        </div>
      }
    >
      {children}
    </Shell>
  );
}
