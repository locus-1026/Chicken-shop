"use client";

import { Shell } from "@/components/layout/Shell";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ShieldCheck,
  GraduationCap,
  Megaphone,
} from "lucide-react";
import { Pill } from "@/components/ui/Pill";

const nav = [
  { href: "/admin/dashboard",     label: "War Room",     icon: <LayoutDashboard size={18} /> },
  { href: "/admin/franchisees",   label: "Franchisees",  icon: <Users size={18} /> },
  { href: "/admin/royalties",     label: "Royalties",    icon: <Receipt size={18} /> },
  { href: "/admin/audits",        label: "Audits",       icon: <ShieldCheck size={18} /> },
  { href: "/admin/training",      label: "Training",     icon: <GraduationCap size={18} /> },
  { href: "/admin/announcements", label: "Announcements", icon: <Megaphone size={18} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      nav={nav}
      title="HQ Admin"
      subtitle="Coco Chick Sdn Bhd · 5 active outlets"
      headerRight={<Pill tone="brand">admin@cocochick.com.my</Pill>}
    >
      {children}
    </Shell>
  );
}
