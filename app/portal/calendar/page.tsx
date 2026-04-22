"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { monthLabel, daysUntil } from "@/lib/utils";
import { PhoneCall, Receipt, Calendar as CalIcon, CheckCircle2, Clock, ChevronDown, ChevronRight, X } from "lucide-react";

function toISODate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() - day); return r; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
type Preset = "all" | "today" | "week" | "month" | "custom";

type CalEvent = {
  id: string;
  kind: "coaching" | "royalty_due";
  at: string;
  title: string;
  body: string;
  tone: "brand" | "success" | "warning" | "danger";
  status?: string;
  proposedTime?: string;
};

type Filter = "all" | "coaching" | "royalty_due";

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
  const [filter, setFilter] = useState<Filter>("all");
  const [showPast, setShowPast] = useState(false);
  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const now = new Date();
    if (p === "all") { setFrom(""); setTo(""); }
    else if (p === "today") { setFrom(toISODate(now)); setTo(toISODate(now)); }
    else if (p === "week") { setFrom(toISODate(startOfWeek(now))); setTo(toISODate(addDays(startOfWeek(now), 6))); }
    else if (p === "month") { setFrom(toISODate(startOfMonth(now))); setTo(toISODate(endOfMonth(now))); }
  };

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
        title: "Coaching call",
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
        title: `Royalty · ${monthLabel(r.period)}`,
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

  const filtered = events.filter((e) => {
    if (filter !== "all" && e.kind !== filter) return false;
    const d = e.at.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const dateFilterActive = !!(from || to);
  const upcoming = filtered.filter((e) => bucket(e.at) !== "past");
  const past = filtered.filter((e) => bucket(e.at) === "past");
  const nextUp = upcoming[0];

  const sections: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "thisWeek", label: "This week" },
    { key: "thisMonth", label: "This month" },
    { key: "later", label: "Later" },
  ];
  const grouped: Record<string, CalEvent[]> = {};
  for (const e of upcoming) (grouped[bucket(e.at)] ??= []).push(e);

  const coachingCount = events.filter((e) => e.kind === "coaching" && bucket(e.at) !== "past").length;
  const royaltyCount = events.filter((e) => e.kind === "royalty_due" && bucket(e.at) !== "past").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><CalIcon size={18} className="text-[color:var(--color-brand)]" /> Your calendar</span>
        </CardTitle>
        <CardSubtitle>Coaching calls and royalty due dates — all in one place.</CardSubtitle>
      </Card>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="All" count={upcoming.length} />
        <FilterTab active={filter === "coaching"} onClick={() => setFilter("coaching")} label="Coaching" count={coachingCount} icon={<PhoneCall size={12} />} />
        <FilterTab active={filter === "royalty_due"} onClick={() => setFilter("royalty_due")} label="Royalties" count={royaltyCount} icon={<Receipt size={12} />} />
      </div>

      {/* Date range filter */}
      <div className="rounded-[14px] border border-[color:var(--color-border)] bg-white p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <PresetChip active={preset === "all" && !dateFilterActive} onClick={() => applyPreset("all")} label="All dates" />
          <PresetChip active={preset === "today"} onClick={() => applyPreset("today")} label="Today" />
          <PresetChip active={preset === "week"} onClick={() => applyPreset("week")} label="This week" />
          <PresetChip active={preset === "month"} onClick={() => applyPreset("month")} label="This month" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="text-[color:var(--color-ink-soft)]">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }}
            className="rounded-md border border-[color:var(--color-border)] bg-white px-2 py-1 text-[12px]"
          />
          <label className="text-[color:var(--color-ink-soft)]">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPreset("custom"); }}
            className="rounded-md border border-[color:var(--color-border)] bg-white px-2 py-1 text-[12px]"
          />
          {dateFilterActive && (
            <button
              onClick={() => applyPreset("all")}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Next up hero */}
      {nextUp && (
        <div className="rounded-[18px] border border-[color:var(--color-brand-200)] bg-gradient-to-br from-[color:var(--color-brand-50)] to-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">Next up</div>
          <EventRow e={nextUp} large />
        </div>
      )}

      {upcoming.length === 0 && (
        <Card>
          <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Nothing scheduled. You&apos;re all caught up.
          </div>
        </Card>
      )}

      {sections.map(({ key, label }) => {
        const items = (grouped[key] ?? []).filter((e) => nextUp ? e.id !== nextUp.id : true);
        if (items.length === 0) return null;
        return (
          <section key={key}>
            <div className="mb-2 flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              {label} <span className="text-[color:var(--color-ink-soft)]/70">· {items.length}</span>
            </div>
            <div className="overflow-hidden rounded-[14px] border border-[color:var(--color-border)] bg-white divide-y divide-[color:var(--color-border)]">
              {items.map((e) => <EventRow key={e.id} e={e} />)}
            </div>
          </section>
        );
      })}

      {past.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            {showPast ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Past · {past.length}
          </button>
          {showPast && (
            <div className="mt-2 overflow-hidden rounded-[14px] border border-[color:var(--color-border)] bg-white divide-y divide-[color:var(--color-border)] opacity-70">
              {past.map((e) => <EventRow key={e.id} e={e} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PresetChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all " +
        (active
          ? "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]"
          : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
      }
    >
      {label}
    </button>
  );
}

function FilterTab({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all " +
        (active
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
          : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand-200)]")
      }
    >
      {icon}
      {label}
      <span className={"ml-0.5 rounded-full px-1.5 text-[10px] " + (active ? "bg-white/20" : "bg-[color:var(--color-surface-soft)]")}>{count}</span>
    </button>
  );
}

function EventRow({ e, large = false }: { e: CalEvent; large?: boolean }) {
  const Icon = e.kind === "coaching" ? PhoneCall : Receipt;
  const accent =
    e.tone === "danger" ? "text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
    : e.tone === "success" ? "text-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
    : e.tone === "warning" ? "text-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]"
    : "text-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]";
  const when = new Date(e.at);
  const dOut = daysUntil(e.at);
  const dateStr = when.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = e.kind === "coaching"
    ? when.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;
  const countdown =
    dOut < 0 ? `${Math.abs(dOut)}d ago`
    : dOut === 0 ? "Today"
    : dOut === 1 ? "Tomorrow"
    : `in ${dOut}d`;
  const countdownTone =
    dOut < 0 ? "text-[color:var(--color-danger)]"
    : dOut === 0 ? "text-[color:var(--color-brand-700)] font-semibold"
    : dOut <= 1 ? "text-[color:var(--color-warning)]"
    : "text-[color:var(--color-ink-soft)]";

  return (
    <div className={large ? "mt-3 flex items-start gap-3" : "flex items-start gap-3 p-3.5"}>
      <div className={"flex shrink-0 items-center justify-center rounded-[10px] " + accent + (large ? " h-12 w-12" : " h-9 w-9")}>
        <Icon size={large ? 20 : 16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={"truncate font-semibold " + (large ? "text-[16px]" : "text-[14px]")}>{e.title}</span>
          {e.status === "accepted" && <Pill tone="success"><CheckCircle2 size={10} /> Accepted</Pill>}
          {e.status === "proposed" && <Pill tone="warning"><Clock size={10} /> You proposed</Pill>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[color:var(--color-ink-soft)]">
          <span>{dateStr}{timeStr ? " · " + timeStr : ""}</span>
          <span className={countdownTone}>· {countdown}</span>
        </div>
        {e.proposedTime && (
          <div className="mt-1 text-[11px] text-[color:var(--color-brand-700)]">Proposed: {e.proposedTime}</div>
        )}
        <p className={"mt-1 leading-relaxed text-[color:var(--color-ink-soft)] " + (large ? "text-[13px]" : "text-[12px] line-clamp-2")}>{e.body}</p>
      </div>
    </div>
  );
}
