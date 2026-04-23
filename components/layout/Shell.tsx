"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/BackButton";

interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  /** Red-dot count rendered after the label — used by HQ to show pending items. */
  badge?: number;
}

export function Shell({
  children,
  nav,
  title,
  subtitle,
  headerRight,
}: {
  children: ReactNode;
  nav: NavItem[];
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/portal" || pathname === "/admin/dashboard";

  return (
    <div className="flex min-h-screen bg-[color:var(--color-background)]">
      {/* Sidebar (desktop) — sticky to top so it stays visible while the main
          column scrolls. `h-screen` + overflow-y-auto so long nav still scrolls
          internally on short viewports. */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-[color:var(--color-border)] bg-white px-5 py-6">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          {/* Brand mark — logo image instead of the old "C" monogram. */}
          <img
            src="/brand/logo.png"
            alt="JI FAN WANG"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight">JI FAN WANG</div>
            <div className="text-[11px] font-medium text-[color:var(--color-ink-soft)]">鸡饭王 · Franchise Portal</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {nav.map((n) => {
            const active = pathname === n.href || (n.href !== "/portal" && pathname?.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]"
                    : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]/60 hover:text-[color:var(--color-ink)]"
                )}
              >
                {n.icon}
                <span className="flex-1">{n.label}</span>
                {typeof n.badge === "number" && n.badge > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1.5 text-[11px] font-semibold text-white">
                    {n.badge > 99 ? "99+" : n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 text-[11px] text-[color:var(--color-ink-soft)]">
          SSM 202101987654 <br /> FR-2021-0317
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-white/75 backdrop-blur px-5 py-3 lg:px-10 lg:py-5">
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-semibold lg:text-[22px]">{title}</h1>
            {subtitle && <p className="truncate text-[13px] text-[color:var(--color-ink-soft)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">{headerRight}</div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[color:var(--color-border)] bg-white px-2 py-1.5 lg:hidden">
          {nav.slice(0, 5).map((n) => {
            const active = pathname === n.href || (n.href !== "/portal" && pathname?.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex min-w-[60px] flex-col items-center rounded-lg px-2 py-1.5 text-[11px] font-medium",
                  active ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-ink-soft)]"
                )}
              >
                <span className="mb-0.5 relative">
                  {n.icon}
                  {typeof n.badge === "number" && n.badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1 text-[10px] font-bold text-white">
                      {n.badge > 9 ? "9+" : n.badge}
                    </span>
                  )}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex-1 px-5 pb-24 pt-5 lg:px-10 lg:pb-10 lg:pt-8"
        >
          {/* Back button is hidden on the portal/admin home pages — nothing
              meaningful to go back to from the root. The data attribute
              lets pages that provide their own contextual back link
              (e.g. "Back to all issues" on a support thread) suppress
              this one via CSS — see `.cc-hide-shell-back` in globals.css. */}
          {!isHome && (
            <div className="mb-4" data-shell-back>
              <BackButton label="Back" fallbackHref={pathname?.startsWith("/admin") ? "/admin/dashboard" : "/portal"} size="sm" />
            </div>
          )}
          {children}
          {!isHome && (
            <div className="mt-8 flex justify-center">
              <BackButton label="Back to previous page" fallbackHref={pathname?.startsWith("/admin") ? "/admin/dashboard" : "/portal"} />
            </div>
          )}
        </motion.main>
      </div>
    </div>
  );
}
