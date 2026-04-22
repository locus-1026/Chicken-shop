"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Outlet, Franchisee } from "@/lib/types";
import { monthLabel, daysUntil } from "@/lib/utils";
import { PhoneCall, Receipt, Calendar as CalIcon, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

type CalEvent = {
  id: string;
  kind: "coaching" | "royalty_due";
  at: string;
  title: string;
  body: string;
  subject: string;     // e.g. "CC-004 · Ahmad Fadzli"
  tone: "brand" | "success" | "warning" | "danger";
  status?: string;
  proposedTime?: string;
  link?: string;
};

function bucket(at: string): "today" | "tomorrow" | "thisWeek" | "thisMonth" | "later" | "past" {
  const d = daysUntil(at);
  if (d < 0) return "past";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d <= 7) return "thisWeek";
  if (d <= 31) return "thisMonth";
  return "later";
}

export default function AdminCalendarPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [events, setEvents] = useState<CalEvent[]>([]);

  const load = useCallback(async () => {
    const [{ data: coaching }, { data: royalties }, { data: outlets }, { data: franchisees }, { data: profs }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, recipient_id, title, body, scheduled_at, status, response_note")
        .eq("kind", "coaching_call")
        .not("scheduled_at", "is", null),
      supabase
        .from("royalties")
        .select("id, outlet_id, due_date, royalty_amount, marketing_fee, status, period:billing_period")
        .neq("status", "paid"),
      supabase.from("outlets").select("*"),
      supabase.from("franchisees").select("*"),
      supabase.from("profiles").select("id, franchisee_id, full_name"),
    ]);

    const outletList = (outlets ?? []) as Outlet[];
    const fList = (franchisees ?? []) as Franchisee[];
    const profList = (profs ?? []) as { id: string; franchisee_id: string | null; full_name: string | null }[];
    const fById = new Map(fList.map((f) => [f.id, f]));
    const outletById = new Map(outletList.map((o) => [o.id, o]));

    const merged: CalEvent[] = [];
    for (const c of ((coaching ?? []) as { id: string; recipient_id: string; title: string; body: string; scheduled_at: string; status?: string; response_note?: string | null }[])) {
      const prof = profList.find((p) => p.id === c.recipient_id);
      const fr = prof?.franchisee_id ? fById.get(prof.franchisee_id) : undefined;
      // Label: prefer an outlet_code for this franchisee (first one) + owner.
      const theirOutlet = outletList.find((o) => o.franchisee_id === fr?.id);
      const subject = fr
        ? `${theirOutlet?.outlet_code ? theirOutlet.outlet_code + " · " : ""}${fr.owner_name}`
        : (prof?.full_name ?? "Franchisee");
      merged.push({
        id: "coach-" + c.id,
        kind: "coaching",
        at: c.scheduled_at,
        title: "Coaching call",
        body: c.body,
        subject,
        tone: c.status === "accepted" ? "success" : c.status === "proposed" ? "warning" : "brand",
        status: c.status,
        proposedTime: c.status === "proposed" ? (c.response_note ?? undefined) : undefined,
        link: theirOutlet ? `/admin/outlets/${theirOutlet.outlet_code}` : undefined,
      });
    }
    for (const r of ((royalties ?? []) as { id: string; outlet_id: string; due_date: string; royalty_amount: number; marketing_fee: number; period: string }[])) {
      const o = outletById.get(r.outlet_id);
      const fr = o?.franchisee_id ? fById.get(o.franchisee_id) : undefined;
      merged.push({
        id: "roy-" + r.id,
        kind: "royalty_due",
        at: r.due_date,
        title: `Royalty due · ${monthLabel(r.period)}`,
        body: `RM ${(r.royalty_amount + r.marketing_fee).toLocaleString()} outstanding.`,
        subject: o ? `${o.outlet_code} · ${fr?.owner_name ?? ""}` : "",
        tone: daysUntil(r.due_date) < 0 ? "danger" : "warning",
        link: "/admin/royalties",
      });
    }

    merged.sort((a, b) => (a.at < b.at ? -1 : 1));
    setEvents(merged);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-calendar")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalties" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  const sections = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "thisWeek", label: "This week" },
    { key: "thisMonth", label: "This month" },
    { key: "later", label: "Later" },
    { key: "past", label: "Past (recent)" },
  ] as const;
  const grouped: Record<string, CalEvent[]> = {};
  for (const e of events) (grouped[bucket(e.at)] ??= []).push(e);

  // KPIs: upcoming counts by status
  const upcomingCoaching = events.filter((e) => e.kind === "coaching" && bucket(e.at) !== "past");
  const overdueRoyalties = events.filter((e) => e.kind === "royalty_due" && bucket(e.at) === "past");
  const proposedReschedules = events.filter((e) => e.status === "proposed");

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><CalIcon size={18} className="text-[color:var(--color-brand)]" /> HQ calendar</span>
        </CardTitle>
        <CardSubtitle>Coaching calls across every franchisee and every royalty due date in one view.</CardSubtitle>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Upcoming coaching" value={`${upcomingCoaching.length}`} tone="brand" />
        <Kpi label="Proposed reschedules" value={`${proposedReschedules.length}`} tone={proposedReschedules.length > 0 ? "warning" : "success"} />
        <Kpi label="Overdue royalties" value={`${overdueRoyalties.length}`} tone={overdueRoyalties.length > 0 ? "danger" : "success"} />
      </div>

      {events.length === 0 && (
        <Card>
          <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Calendar empty — no coaching calls or outstanding royalties.
          </div>
        </Card>
      )}

      {sections.map(({ key, label }) => {
        const items = grouped[key] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={key}>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              {label} <span className="ml-1 text-[color:var(--color-ink-soft)]">· {items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((e) => <EventCard key={e.id} e={e} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "brand" | "warning" | "danger" | "success" }) {
  const cls =
    tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "success" ? "text-[color:var(--color-success)]"
    : "";
  return (
    <Card>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-1 text-[22px] font-semibold " + cls}>{value}</div>
    </Card>
  );
}

function EventCard({ e }: { e: CalEvent }) {
  const Icon = e.kind === "coaching" ? PhoneCall : Receipt;
  const borderTone =
    e.tone === "danger" ? "!border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
    : e.tone === "success" ? "!border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
    : e.tone === "warning" ? "!border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]"
    : "!border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/60";
  const when = new Date(e.at);
  const whenNice = when.toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const dOut = daysUntil(e.at);
  const countdown =
    dOut < 0 ? `${Math.abs(dOut)} day${Math.abs(dOut) !== 1 ? "s" : ""} ago`
    : dOut === 0 ? "today"
    : dOut === 1 ? "tomorrow"
    : `in ${dOut} days`;

  const card = (
    <article className={"rounded-[16px] border p-4 transition-all hover:-translate-y-0.5 " + borderTone}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-ink)]">
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[15px] font-semibold">{e.title}</h4>
            {e.status === "accepted" && <Pill tone="success"><CheckCircle2 size={10} /> Accepted</Pill>}
            {e.status === "proposed" && <Pill tone="warning"><Clock size={10} /> Reschedule proposed</Pill>}
            {e.tone === "danger" && <Pill tone="danger"><AlertTriangle size={10} /> Overdue</Pill>}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-[color:var(--color-ink)]">
            {e.subject}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">{whenNice} · {countdown}</div>
          {e.proposedTime && (
            <div className="mt-0.5 text-[11px] text-[color:var(--color-brand-700)]">Franchisee proposed: {e.proposedTime}</div>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">{e.body}</p>
        </div>
      </div>
    </article>
  );

  if (e.link) return <Link href={e.link} className="block">{card}</Link>;
  return card;
}
