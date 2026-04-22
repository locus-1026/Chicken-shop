"use client";

import { useEffect, useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import type { Royalty, Announcement } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
import { formatDate, RM2, daysUntil } from "@/lib/utils";
import { Pin, Calendar, Megaphone, Bell, PhoneCall, FileWarning, Receipt, TrendingUp, GraduationCap } from "lucide-react";
import Link from "next/link";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  status?: string;
  response_note?: string | null;
  responded_at?: string | null;
};

export default function AnnouncementsPage() {
  const { outlet } = useCurrentOutlet();
  const { profile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load + live-subscribe to direct HQ notifications for this user.
  useEffect(() => {
    if (!profile?.id) return;
    const refresh = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at, status, response_note, responded_at")
        .eq("recipient_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications((data ?? []) as Notification[]);
      // Only auto-clear notifications that don't require action (plain info).
      // Anything needing accept/propose/acknowledge/on-it/done stays unread
      // in the bell until the franchisee actually takes the action.
      const actionable = (k: string) =>
        k === "coaching_call" || k === "warning_notice" || k.startsWith("nudge_");
      const autoClearIds = (data ?? [])
        .filter((n: Notification) => !n.read_at && (!actionable(n.kind) || !!n.responded_at))
        .map((n: Notification) => n.id);
      if (autoClearIds.length > 0) {
        await supabase.from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", autoClearIds);
      }
    };
    refresh();
    const channel = supabase
      .channel("portal-news-notifications-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, profile?.id]);

  // Fetch announcements + read receipts + outstanding royalty for pinned card.
  useEffect(() => {
    (async () => {
      const [{ data: ann }, { data: rds }] = await Promise.all([
        supabase.from("announcements").select("*").order("publish_at", { ascending: false }),
        profile?.id
          ? supabase.from("announcement_reads").select("announcement_id").eq("user_id", profile.id)
          : Promise.resolve({ data: [] as { announcement_id: string }[] }),
      ]);
      setAnnouncements((ann ?? []) as Announcement[]);
      setReads(new Set((rds ?? []).map((r: { announcement_id: string }) => r.announcement_id)));
    })();
    if (!profile?.id) return;
    const channel = supabase
      .channel("portal-announcements-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, async () => {
        const { data } = await supabase.from("announcements").select("*").order("publish_at", { ascending: false });
        setAnnouncements((data ?? []) as Announcement[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, profile?.id]);

  // Fetch the nearest outstanding royalty for THIS outlet from Supabase so
  // the pinned card matches what /portal/royalty and HQ actually see.
  const [outstandingRoyalties, setOutstandingRoyalties] = useState<Royalty[]>([]);
  const [verifiedByRoyalty, setVerifiedByRoyalty] = useState<Record<string, boolean>>({});
  useEffect(() => {
    (async () => {
      const { data: roys } = await supabase
        .from("royalties")
        .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
        .eq("outlet_id", outlet.id)
        .neq("status", "paid")
        .order("due_date", { ascending: true });
      const rs = (roys ?? []) as Royalty[];
      setOutstandingRoyalties(rs);
      if (rs.length > 0) {
        const { data: proofRows } = await supabase
          .from("royalty_proofs")
          .select("royalty_id, verified_at")
          .in("royalty_id", rs.map((r) => r.id));
        const v: Record<string, boolean> = {};
        for (const p of (proofRows ?? []) as { royalty_id: string; verified_at: string | null }[]) {
          if (p.verified_at) v[p.royalty_id] = true;
        }
        setVerifiedByRoyalty(v);
      }
    })();
  }, [outlet.id, supabase]);
  const livePinned = useMemo(
    () => outstandingRoyalties.find((r) => !verifiedByRoyalty[r.id]) ?? null,
    [outstandingRoyalties, verifiedByRoyalty]
  );

  const otherAnnouncements = announcements
    .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1));
  const pinned = otherAnnouncements.filter((a) => a.pinned);
  const rest = otherAnnouncements.filter((a) => !a.pinned);

  const markRead = async (id: string) => {
    if (reads.has(id)) return;
    setReads((prev) => new Set([...prev, id]));
    if (profile?.id) {
      await supabase.from("announcement_reads").insert({
        announcement_id: id,
        user_id: profile.id,
      });
    }
  };

  const renderCard = (a: Announcement) => {
    const unread = !reads.has(a.id);
    return (
      <article
        key={a.id}
        onClick={() => markRead(a.id)}
        className={
          "cursor-pointer rounded-[16px] border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
          (unread
            ? "border-l-4 border-l-[color:var(--color-brand)] border-t-[color:var(--color-border)] border-r-[color:var(--color-border)] border-b-[color:var(--color-border)] pl-5"
            : "border-[color:var(--color-border)]")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[color:var(--color-ink)]">{a.title}</h3>
            <span className="text-[11px] text-[color:var(--color-ink-soft)]">{formatDate(a.publish_at)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.pinned && <Pill tone="brand"><Pin size={12} /> Pinned</Pill>}
            {unread && <Pill tone="warning">New</Pill>}
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--color-ink)]">{a.body}</p>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          Pinned
        </div>
        <div className="space-y-4">
          <LivePinnedCard royalty={livePinned ?? undefined} outletCode={outlet.outlet_code} />
          {pinned.map(renderCard)}
        </div>
      </section>

      {notifications.length > 0 && (
        <section>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            From HQ to you
          </div>
          <div className="space-y-3">
            {notifications.map((n) => <NotificationCard key={n.id} n={n} />)}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          Recent
        </div>
        {rest.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--color-border)] bg-white p-8 text-center text-sm text-[color:var(--color-ink-soft)]">
            No announcements yet.
          </div>
        ) : (
          <div className="space-y-4">{rest.map(renderCard)}</div>
        )}
      </section>
    </div>
  );
}

function NotificationCard({ n }: { n: Notification }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [proposing, setProposing] = useState(false);
  const [proposedTime, setProposedTime] = useState("");
  const [busy, setBusy] = useState(false);

  const wasUnread = !n.read_at;
  const Icon =
    n.kind === "coaching_call" ? PhoneCall
    : n.kind === "warning_notice" ? FileWarning
    : n.kind === "nudge_royalty" ? Receipt
    : n.kind === "nudge_sales" ? TrendingUp
    : n.kind === "nudge_training" ? GraduationCap
    : Bell;
  const tone = n.kind === "warning_notice" ? "danger" : n.kind === "coaching_call" ? "brand" : "warning";
  const borderTone =
    tone === "danger" ? "!border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]"
    : tone === "brand" ? "!border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/60"
    : "!border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)]";

  const respond = async (status: string, note?: string) => {
    setBusy(true);
    // Clear the bell only when the franchisee actually acts on the notification.
    const now = new Date().toISOString();
    await supabase.from("notifications")
      .update({ status, response_note: note ?? null, responded_at: now, read_at: now })
      .eq("id", n.id);
    setBusy(false);
    setProposing(false);
  };

  // Lets the franchisee undo a response they didn't mean to submit (or a
  // stale/seed status). Brings the action buttons back.
  const resetResponse = async () => {
    setBusy(true);
    await supabase.from("notifications")
      .update({ status: null, response_note: null, responded_at: null })
      .eq("id", n.id);
    setBusy(false);
  };

  const hasResponded = !!n.responded_at;
  const statusLabel =
    n.status === "accepted" ? "You accepted"
    : n.status === "proposed" ? "You proposed: " + (n.response_note ?? "")
    : n.status === "acknowledged" ? "You acknowledged"
    : n.status === "in_progress" ? "Marked as on it"
    : n.status === "done" ? "Marked done"
    : null;

  const isCoach = n.kind === "coaching_call";
  const isNotice = n.kind === "warning_notice";
  const isNudge = n.kind.startsWith("nudge_");

  return (
    <article className={"rounded-[16px] border p-4 " + borderTone}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-ink)]">
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[14px] font-semibold">{n.title}</h4>
            {wasUnread && <Pill tone="danger">New</Pill>}
            {hasResponded && <Pill tone="success">Responded</Pill>}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed">{n.body}</p>
          <div className="mt-1.5 text-[11px] text-[color:var(--color-ink-soft)]">{formatDate(n.created_at)}</div>
          {n.link && !hasResponded && (
            <Link href={n.link} className="mt-2 inline-block text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              Open related page →
            </Link>
          )}

          {/* Response UI */}
          {hasResponded ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-[12px]">
              <span><b>Your response:</b> {statusLabel} · {n.responded_at ? formatDate(n.responded_at) : ""}</span>
              <button
                onClick={resetResponse}
                disabled={busy}
                className="rounded-full border border-[color:var(--color-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
              >
                Change response
              </button>
            </div>
          ) : (
            <div className="mt-3">
              {isCoach && !proposing && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="success" onClick={() => respond("accepted")} disabled={busy}>Accept time</Button>
                  <Button size="sm" variant="outline" onClick={() => setProposing(true)} disabled={busy}>Propose another time</Button>
                </div>
              )}
              {isCoach && proposing && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={proposedTime}
                    onChange={(e) => setProposedTime(e.target.value)}
                    className="rounded-lg border border-[color:var(--color-border)] bg-white px-2 py-1 text-[12px]"
                  />
                  <Button size="sm" onClick={() => respond("proposed", proposedTime)} disabled={!proposedTime || busy}>Send proposal</Button>
                  <Button size="sm" variant="ghost" onClick={() => setProposing(false)}>Cancel</Button>
                </div>
              )}
              {isNotice && (
                <Button size="sm" onClick={() => respond("acknowledged")} disabled={busy}>
                  Acknowledge notice
                </Button>
              )}
              {isNudge && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => respond("in_progress")} disabled={busy}>I&apos;m on it</Button>
                  <Button size="sm" variant="success" onClick={() => respond("done")} disabled={busy}>Done</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function LivePinnedCard({
  royalty,
  outletCode,
}: {
  royalty: { id: string; period: string; due_date: string; royalty_amount: number; marketing_fee: number } | undefined;
  outletCode: string;
}) {
  const royaltyTotal = royalty ? royalty.royalty_amount + royalty.marketing_fee : 0;
  const days = royalty ? daysUntil(royalty.due_date) : null;

  return (
    <article className="rounded-[16px] border border-[color:var(--color-brand-200)] bg-gradient-to-br from-[color:var(--color-brand-50)] to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand)] px-2 py-0.5 text-[11px] font-semibold text-white">
            <Pin size={10} /> Live reminder
          </div>
          <h3 className="mt-2 text-[15px] font-semibold">This week for {outletCode}</h3>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            <Calendar size={12} /> Nearest royalty
          </div>
          {royalty ? (
            <>
              <div className="mt-1 text-[15px] font-semibold">{RM2(royaltyTotal)}</div>
              <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                Due {formatDate(royalty.due_date)}
                {" · "}
                {days !== null && (
                  <b className={(days ?? 0) < 0 ? "text-[color:var(--color-danger)]" : (days ?? 0) <= 3 ? "text-[color:var(--color-warning)]" : "text-[color:var(--color-ink)]"}>
                    {(days ?? 0) < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                  </b>
                )}
              </div>
            </>
          ) : (
            <div className="mt-1 text-[13px] text-[color:var(--color-success)]">All statements settled — nice work.</div>
          )}
        </div>

        <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            <Megaphone size={12} /> Current campaign
          </div>
          <div className="mt-1 text-[15px] font-semibold">Mother's Day Bundle</div>
          <div className="text-[12px] text-[color:var(--color-ink-soft)]">
            Runs 3–12 May · Creative pack in Marketing tab
          </div>
        </div>
      </div>
    </article>
  );
}
