"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDate, monthLabel, RM2, daysUntil } from "@/lib/utils";
import { PhoneCall, Receipt, ShieldCheck, Calendar as CalIcon, CheckCircle2, Clock } from "lucide-react";

// Event kinds the calendar aggregates — all have a date + title + tone.
type CalEvent = {
  id: string;
  kind: "coaching" | "royalty_due" | "audit_window";
  at: string;            // ISO
  title: string;
  body: string;
  tone: "brand" | "success" | "warning" | "danger";
  status?: string;       // for coaching: open/accepted/proposed/...
  proposedTime?: string; // franchisee's counter-proposal for coaching
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

export default function CalendarPage() {
  const { outlet } = useCurrentOutlet();
  const { profile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [events, setEvents] = useState<CalEvent[]>([]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [{ data: coaching }, { data: royalties }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, kind, title, body, scheduled_at, status, response_note")
        .eq("recipient_id", profile.id)
        .eq("kind", "coaching_call")
        .not("scheduled_at", "is", null),
      supabase
        .from("royalties")
        .select("id, due_date, royalty_amount, marketing_fee, status, period:billing_period")
        .eq("outlet_id", outlet.id)
        .neq("status", "paid"),
    ]);

    const merged: CalEvent[] = [];
    for (const c of ((coaching ?? []) as { id: string; title: string; body: string; scheduled_at: string; status?: string; response_note?: string | null }[])) {
      merged.push({
        id: "coach-" + c.id,
        kind: "coaching",
        at: c.scheduled_at,
        title: c.title,
        body: c.body,
        tone: c.status === "accepted" ? "success" : c.status === "proposed" ? "warning" : "brand",
        status: c.status,
        proposedTime: c.status === "proposed" ? (c.response_note ?? undefined) : undefined,
      });
    }
    for (const r of ((royalties ?? []) as { id: string; due_date: string; royalty_amount: number; marketing_fee: number; period: string }[])) {
      merged.push({
        id: "roy-" + r.id,
        kind: "royalty_due",
        at: r.due_date,
        title: `Royalty due · ${monthLabel(r.period)}`,
        body: `RM ${(r.royalty_amount + r.marketing_fee).toLocaleString()} owed to HQ.`,
        tone: daysUntil(r.due_date) < 0 ? "danger" : "warning",
      });
    }

    merged.sort((a, b) => (a.at < b.at ? -1 : 1));
    setEvents(merged);
  }, [supabase, profile?.id, outlet.id]);

  useEffect(() => {
    load();
    if (!profile?.id) return;
    const channel = supabase
      .channel("portal-calendar-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalties" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase, profile?.id]);

  const sections: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "thisWeek", label: "This week" },
    { key: "thisMonth", label: "This month" },
    { key: "later", label: "Later" },
    { key: "past", label: "Past (recent)" },
  ];
  const grouped: Record<string, CalEvent[]> = {};
  for (const e of events) (grouped[bucket(e.at)] ??= []).push(e);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><CalIcon size={18} className="text-[color:var(--color-brand)]" /> Your calendar</span>
        </CardTitle>
        <CardSubtitle>Coaching calls, royalty due dates and audit windows — all in one place.</CardSubtitle>
      </Card>

      {events.length === 0 && (
        <Card>
          <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Nothing scheduled. You&apos;re all caught up.
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

function EventCard({ e }: { e: CalEvent }) {
  const Icon = e.kind === "coaching" ? PhoneCall : e.kind === "royalty_due" ? Receipt : ShieldCheck;
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

  return (
    <article className={"rounded-[16px] border p-4 " + borderTone}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-ink)]">
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[15px] font-semibold">{e.title}</h4>
            {e.status === "accepted" && <Pill tone="success"><CheckCircle2 size={10} /> Accepted</Pill>}
            {e.status === "proposed" && <Pill tone="warning"><Clock size={10} /> You proposed</Pill>}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-[color:var(--color-ink)]">{whenNice} · {countdown}</div>
          {e.proposedTime && (
            <div className="mt-0.5 text-[11px] text-[color:var(--color-ink-soft)]">Proposed new time: {e.proposedTime}</div>
          )}
          <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">{e.body}</p>
        </div>
      </div>
    </article>
  );
}
