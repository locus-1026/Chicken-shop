"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Outlet, Franchisee } from "@/lib/types";
import { monthLabel, daysUntil } from "@/lib/utils";
import {
  PhoneCall, Receipt, Calendar as CalIcon, CheckCircle2, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, User, XCircle, HelpCircle,
} from "lucide-react";

function StatusPill({ e }: { e: CalEvent }) {
  if (e.kind === "coaching") {
    if (e.status === "accepted") return <Pill tone="success"><CheckCircle2 size={10} /> Accepted</Pill>;
    if (e.status === "proposed") return <Pill tone="warning"><Clock size={10} /> Reschedule proposed</Pill>;
    if (e.status === "declined" || e.status === "cancelled") return <Pill tone="danger"><XCircle size={10} /> Cancelled</Pill>;
    if (e.status === "done") return <Pill tone="success"><CheckCircle2 size={10} /> Done</Pill>;
    return <Pill tone="warning"><HelpCircle size={10} /> Awaiting reply</Pill>;
  }
  if (e.tone === "danger") return <Pill tone="danger"><AlertTriangle size={10} /> Overdue</Pill>;
  return <Pill tone="warning"><Clock size={10} /> Due</Pill>;
}

type CalEvent = {
  id: string;
  kind: "coaching" | "royalty_due";
  at: string;
  title: string;
  body: string;
  subject: string;
  tone: "brand" | "success" | "warning" | "danger";
  status?: string;
  proposedTime?: string;
  link?: string;
};

type Filter = "all" | "coaching" | "royalty_due";

function toISODate(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); r.setDate(r.getDate() - r.getDay() + (r.getDay() === 0 ? -6 : 1)); return r; }
function sameDay(a: string, b: string) { return a.slice(0, 10) === b.slice(0, 10); }

export default function AdminCalendarPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [weekAnchor, setWeekAnchor] = useState<Date>(startOfWeek(new Date()));

  const load = useCallback(async () => {
    const [{ data: coaching }, { data: royalties }, { data: outlets }, { data: franchisees }, { data: profs }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, recipient_id, title, body, scheduled_at, status, response_note, responded_at")
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

    const seenCoach = new Set<string>();
    const merged: CalEvent[] = [];
    for (const c of ((coaching ?? []) as { id: string; recipient_id: string; title: string; body: string; scheduled_at: string; status?: string; response_note?: string | null; responded_at?: string | null }[])) {
      const prof = profList.find((p) => p.id === c.recipient_id);
      const fr = prof?.franchisee_id ? fById.get(prof.franchisee_id) : undefined;
      const theirOutlet = outletList.find((o) => o.franchisee_id === fr?.id);
      const dedupKey = (fr?.id ?? c.recipient_id) + "|" + c.scheduled_at;
      if (seenCoach.has(dedupKey)) continue;
      seenCoach.add(dedupKey);
      const subject = fr
        ? `${theirOutlet?.outlet_code ? theirOutlet.outlet_code + " · " : ""}${fr.owner_name}`
        : (prof?.full_name ?? "Franchisee");
      // Only honour a status after the franchisee has actually pressed a
      // response button — stale/default statuses shouldn't mislead HQ.
      const effectiveStatus = c.responded_at ? c.status : undefined;
      merged.push({
        id: "coach-" + c.id,
        kind: "coaching",
        at: c.scheduled_at,
        title: "Coaching call",
        body: c.body,
        subject,
        tone: effectiveStatus === "accepted" ? "success" : effectiveStatus === "proposed" ? "warning" : "brand",
        status: effectiveStatus,
        proposedTime: effectiveStatus === "proposed" ? (c.response_note ?? undefined) : undefined,
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
        title: `Royalty · ${monthLabel(r.period)}`,
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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor]);
  const filteredAll = events.filter((e) => filter === "all" || e.kind === filter);

  const countsByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of filteredAll) { const d = e.at.slice(0, 10); m[d] = (m[d] ?? 0) + 1; }
    return m;
  }, [filteredAll]);

  const dayEvents = filteredAll.filter((e) => sameDay(e.at, selectedDate));
  const allDay = dayEvents.filter((e) => e.kind === "royalty_due");
  const morning = dayEvents.filter((e) => e.kind !== "royalty_due" && new Date(e.at).getHours() < 12);
  const afternoon = dayEvents.filter((e) => e.kind !== "royalty_due" && new Date(e.at).getHours() >= 12 && new Date(e.at).getHours() < 18);
  const evening = dayEvents.filter((e) => e.kind !== "royalty_due" && new Date(e.at).getHours() >= 18);

  const rangeLabel = `${weekDays[0].toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`;

  const goToday = () => { const now = new Date(); setWeekAnchor(startOfWeek(now)); setSelectedDate(toISODate(now)); };
  const prevWeek = () => setWeekAnchor(addDays(weekAnchor, -7));
  const nextWeek = () => setWeekAnchor(addDays(weekAnchor, 7));

  const upcomingCoaching = events.filter((e) => e.kind === "coaching" && e.at.slice(0, 10) >= toISODate(new Date())).length;
  const proposedCount = events.filter((e) => e.status === "proposed").length;
  const overdueCount = events.filter((e) => e.kind === "royalty_due" && daysUntil(e.at) < 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><CalIcon size={18} className="text-[color:var(--color-brand)]" /> HQ calendar</span>
        </CardTitle>
        <CardSubtitle>Coaching calls and royalty due dates across all outlets — one view.</CardSubtitle>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Upcoming coaching" value={upcomingCoaching} tone="brand" />
        <Kpi label="Proposed reschedules" value={proposedCount} tone={proposedCount > 0 ? "warning" : "success"} />
        <Kpi label="Overdue royalties" value={overdueCount} tone={overdueCount > 0 ? "danger" : "success"} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={prevWeek} className="rounded-full border border-[color:var(--color-border)] bg-white p-2 hover:bg-[color:var(--color-surface-soft)]" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <button onClick={goToday} className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-[color:var(--color-surface-soft)]">
          <CalIcon size={13} /> Today
        </button>
        <button onClick={nextWeek} className="rounded-full border border-[color:var(--color-border)] bg-white p-2 hover:bg-[color:var(--color-surface-soft)]" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
        <div className="ml-1 text-[14px] font-semibold">{rangeLabel}</div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          <FilterTab active={filter === "coaching"} onClick={() => setFilter("coaching")} label="Coaching" icon={<PhoneCall size={11} />} />
          <FilterTab active={filter === "royalty_due"} onClick={() => setFilter("royalty_due")} label="Royalties" icon={<Receipt size={11} />} />
        </div>
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d) => {
          const iso = toISODate(d);
          const selected = iso === selectedDate;
          const count = countsByDay[iso] ?? 0;
          const isToday = iso === toISODate(new Date());
          return (
            <button
              key={iso}
              onClick={() => setSelectedDate(iso)}
              className={
                "rounded-[14px] border px-2 py-3 text-left transition-all " +
                (selected
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white shadow-sm"
                  : "border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-brand-200)]")
              }
            >
              <div className={"text-[10px] font-semibold uppercase tracking-wider " + (selected ? "text-white/80" : "text-[color:var(--color-ink-soft)]")}>
                {d.toLocaleDateString("en-MY", { weekday: "short" })}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={"text-[22px] font-semibold leading-none " + (isToday && !selected ? "text-[color:var(--color-brand-700)]" : "")}>{d.getDate()}</span>
                {count > 0 && (
                  <span className={
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold " +
                    (selected ? "bg-white/20 text-white" : "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]")
                  }>
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--color-ink-soft)]">
        <LegendDot color="var(--color-success)" label="Accepted" />
        <LegendDot color="var(--color-warning)" label="Proposed / Royalty due" />
        <LegendDot color="var(--color-brand)" label="Coaching" />
        <LegendDot color="var(--color-danger)" label="Overdue" />
      </div>

      {/* Overdue / out-of-week items — persistent, not tied to the current week view */}
      {(() => {
        const todayIso = toISODate(new Date());
        const overdue = filteredAll.filter((e) => e.at.slice(0, 10) < todayIso);
        if (overdue.length === 0) return null;
        return (
          <section className="rounded-[14px] border border-[color:var(--color-danger)]/50 bg-[color:var(--color-danger-soft)]/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-danger)]">
              <AlertTriangle size={14} /> Overdue · {overdue.length}
              <span className="ml-1 font-normal normal-case tracking-normal text-[color:var(--color-ink-soft)]">(not on this week — jump to the date)</span>
            </div>
            <div className="space-y-2">
              {overdue.map((e) => {
                const d = new Date(e.at);
                return (
                  <button
                    key={"od-" + e.id}
                    onClick={() => {
                      setWeekAnchor(startOfWeek(d));
                      setSelectedDate(toISODate(d));
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-[color:var(--color-border)] bg-white p-3 text-left hover:border-[color:var(--color-danger)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold">{e.title}</div>
                      <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
                        {e.subject} · was due {d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} ({Math.abs(daysUntil(e.at))}d ago)
                      </div>
                    </div>
                    <StatusPill e={e} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })()}

      {dayEvents.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Nothing scheduled on {new Date(selectedDate).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "short" })}.
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {allDay.length > 0 && <TimeSection label="All day" count={allDay.length} items={allDay} />}
          {morning.length > 0 && <TimeSection label="Morning" count={morning.length} items={morning} />}
          {afternoon.length > 0 && <TimeSection label="Afternoon" count={afternoon.length} items={afternoon} />}
          {evening.length > 0 && <TimeSection label="Evening" count={evening.length} items={evening} />}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "brand" | "warning" | "danger" | "success" }) {
  const cls =
    tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "success" ? "text-[color:var(--color-success)]"
    : "";
  return (
    <div className="rounded-[14px] border border-[color:var(--color-border)] bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-1 text-[24px] font-semibold leading-none " + cls}>{value}</div>
    </div>
  );
}

function TimeSection({ label, count, items }: { label: string; count: number; items: CalEvent[] }) {
  return (
    <section>
      <div className="mb-2 text-[12px] text-[color:var(--color-ink-soft)]">
        {label} <span className="text-[color:var(--color-ink-soft)]/70">· {count} {count === 1 ? "item" : "items"}</span>
      </div>
      <div className="space-y-2">
        {items.map((e) => <EventCard key={e.id} e={e} />)}
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function FilterTab({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all " +
        (active
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
          : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand-200)]")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function EventCard({ e }: { e: CalEvent }) {
  const when = new Date(e.at);
  const isRoyalty = e.kind === "royalty_due";
  const timeStart = isRoyalty ? null : when.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
  const timeEnd = isRoyalty ? null : new Date(when.getTime() + 30 * 60_000).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
  const duration = isRoyalty ? "all day" : "30min";

  const borderTone =
    e.tone === "success" ? "border-l-[color:var(--color-success)]"
    : e.tone === "warning" ? "border-l-[color:var(--color-warning)]"
    : e.tone === "danger" ? "border-l-[color:var(--color-danger)]"
    : "border-l-[color:var(--color-brand)]";

  const inner = (
    <article className={"rounded-[14px] border border-[color:var(--color-border)] border-l-4 bg-white p-4 transition-all hover:shadow-sm " + borderTone}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--color-ink)]">
            <Clock size={13} className="text-[color:var(--color-ink-soft)]" />
            {isRoyalty
              ? <span>All day</span>
              : <span><span className="font-semibold">{timeStart}</span> – {timeEnd}</span>}
            <span className="text-[color:var(--color-ink-soft)]">· {duration}</span>
          </div>
          <h4 className="mt-2 text-[15px] font-semibold">{e.title}</h4>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-soft)]">{e.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-ink-soft)]">
            <span className="inline-flex items-center gap-1"><User size={12} /> {e.subject}</span>
            {e.kind === "coaching" && <span className="inline-flex items-center gap-1"><PhoneCall size={12} /> Phone call</span>}
            {e.kind === "royalty_due" && <span className="inline-flex items-center gap-1"><Receipt size={12} /> Royalty</span>}
          </div>
          {e.proposedTime && (
            <div className="mt-2 rounded-md bg-[color:var(--color-warning-soft)] px-2 py-1 text-[11px] text-[color:var(--color-warning)]">
              Franchisee proposed: {e.proposedTime}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <StatusPill e={e} />
        </div>
      </div>
    </article>
  );

  return e.link ? <Link href={e.link} className="block">{inner}</Link> : inner;
}
