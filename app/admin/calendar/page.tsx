"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Outlet, Franchisee } from "@/lib/types";
import { monthLabel, daysUntil } from "@/lib/utils";
import { PhoneCall, Receipt, Calendar as CalIcon, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

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
  const [filter, setFilter] = useState<Filter>("all");
  const [showPast, setShowPast] = useState(false);

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

    // De-dup coaching: if multiple profiles under same franchisee get the same call, show once.
    const seenCoach = new Set<string>();
    const merged: CalEvent[] = [];
    for (const c of ((coaching ?? []) as { id: string; recipient_id: string; title: string; body: string; scheduled_at: string; status?: string; response_note?: string | null }[])) {
      const prof = profList.find((p) => p.id === c.recipient_id);
      const fr = prof?.franchisee_id ? fById.get(prof.franchisee_id) : undefined;
      const theirOutlet = outletList.find((o) => o.franchisee_id === fr?.id);
      const dedupKey = (fr?.id ?? c.recipient_id) + "|" + c.scheduled_at;
      if (seenCoach.has(dedupKey)) continue;
      seenCoach.add(dedupKey);
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

  const filtered = events.filter((e) => filter === "all" || e.kind === filter);
  const upcoming = filtered.filter((e) => bucket(e.at) !== "past");
  const past = filtered.filter((e) => bucket(e.at) === "past");
  const nextUp = upcoming[0];

  const sections = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "thisWeek", label: "This week" },
    { key: "thisMonth", label: "This month" },
    { key: "later", label: "Later" },
  ] as const;
  const grouped: Record<string, CalEvent[]> = {};
  for (const e of upcoming) (grouped[bucket(e.at)] ??= []).push(e);

  const upcomingCoaching = events.filter((e) => e.kind === "coaching" && bucket(e.at) !== "past");
  const overdueRoyalties = events.filter((e) => e.kind === "royalty_due" && bucket(e.at) === "past");
  const proposedReschedules = events.filter((e) => e.status === "proposed");
  const coachingCount = upcomingCoaching.length;
  const royaltyCount = events.filter((e) => e.kind === "royalty_due" && bucket(e.at) !== "past").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-2"><CalIcon size={18} className="text-[color:var(--color-brand)]" /> HQ calendar</span>
        </CardTitle>
        <CardSubtitle>Coaching calls and royalty due dates across all outlets — one view.</CardSubtitle>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Upcoming coaching" value={upcomingCoaching.length} tone="brand" />
        <Kpi label="Proposed reschedules" value={proposedReschedules.length} tone={proposedReschedules.length > 0 ? "warning" : "success"} />
        <Kpi label="Overdue royalties" value={overdueRoyalties.length} tone={overdueRoyalties.length > 0 ? "danger" : "success"} />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="All" count={upcoming.length} />
        <FilterTab active={filter === "coaching"} onClick={() => setFilter("coaching")} label="Coaching" count={coachingCount} icon={<PhoneCall size={12} />} />
        <FilterTab active={filter === "royalty_due"} onClick={() => setFilter("royalty_due")} label="Royalties" count={royaltyCount} icon={<Receipt size={12} />} />
      </div>

      {/* Next up hero */}
      {nextUp && (
        <div className="rounded-[18px] border border-[color:var(--color-brand-200)] bg-gradient-to-br from-[color:var(--color-brand-50)] to-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">Next up</div>
          {nextUp.link ? (
            <Link href={nextUp.link} className="block"><EventRow e={nextUp} large /></Link>
          ) : (
            <EventRow e={nextUp} large />
          )}
        </div>
      )}

      {upcoming.length === 0 && (
        <Card>
          <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Calendar empty — no coaching calls or outstanding royalties.
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
              {items.map((e) => (
                e.link
                  ? <Link key={e.id} href={e.link} className="block hover:bg-[color:var(--color-surface-soft)]/40"><EventRow e={e} /></Link>
                  : <EventRow key={e.id} e={e} />
              ))}
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
              {past.map((e) => (
                e.link
                  ? <Link key={e.id} href={e.link} className="block hover:bg-[color:var(--color-surface-soft)]/40"><EventRow e={e} /></Link>
                  : <EventRow key={e.id} e={e} />
              ))}
            </div>
          )}
        </section>
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
          {e.status === "proposed" && <Pill tone="warning"><Clock size={10} /> Reschedule</Pill>}
          {e.tone === "danger" && e.kind === "royalty_due" && <Pill tone="danger"><AlertTriangle size={10} /> Overdue</Pill>}
        </div>
        <div className="mt-0.5 text-[12px] font-medium text-[color:var(--color-ink)]">{e.subject}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[color:var(--color-ink-soft)]">
          <span>{dateStr}{timeStr ? " · " + timeStr : ""}</span>
          <span className={countdownTone}>· {countdown}</span>
        </div>
        {e.proposedTime && (
          <div className="mt-1 text-[11px] text-[color:var(--color-brand-700)]">Franchisee proposed: {e.proposedTime}</div>
        )}
        <p className={"mt-1 leading-relaxed text-[color:var(--color-ink-soft)] " + (large ? "text-[13px]" : "text-[12px] line-clamp-1")}>{e.body}</p>
      </div>
    </div>
  );
}
