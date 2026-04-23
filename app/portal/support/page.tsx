"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { SupportTicket, TicketMessage } from "@/lib/types";
import { Paperclip, Send, ArrowLeft, ShieldCheck, User, Clock, BellRing } from "lucide-react";

const categories = ["IT / POS", "Supply Chain", "Marketing", "HR / Staffing", "Facility", "Other"];

export default function SupportPage() {
  const { outlet, franchisee } = useCurrentOutlet();
  const { profile } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [form, setForm] = useState({ category: categories[0], subject: "", description: "" });
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const { data: ts } = await supabase
      .from("support_tickets")
      .select("id, outlet_id, category, subject, description, photo_url, status, created_at")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: false });
    const ticketRows = (ts ?? []) as SupportTicket[];
    setTickets(ticketRows);
    if (ticketRows.length > 0) {
      const { data: ms } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, author, author_name, body, created_at")
        .in("ticket_id", ticketRows.map((t) => t.id))
        .order("created_at", { ascending: true });
      setMessages((ms ?? []) as TicketMessage[]);
    } else {
      setMessages([]);
    }
  }, [supabase, outlet.id]);

  useEffect(() => {
    load();
    // Mark support as seen so the sidebar Help badge clears.
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cc.portal.support.lastSeen." + outlet.id, new Date().toISOString());
      window.dispatchEvent(new Event("cc.support-seen"));
    }
    const channel = supabase
      .channel("portal-support-" + outlet.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `outlet_id=eq.${outlet.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase, outlet.id]);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [tickets]
  );

  const submit = async () => {
    if (!form.subject.trim()) {
      toast("error", "Please add a short subject.");
      return;
    }
    if (form.description.trim().length < 10) {
      toast("error", "Please describe the issue in at least 10 characters.");
      return;
    }
    const { data: inserted, error } = await supabase
      .from("support_tickets")
      .insert({
        outlet_id: outlet.id,
        submitted_by: profile?.id,
        category: form.category,
        subject: form.subject,
        description: form.description,
        photo_url: null,
        status: "open",
      })
      .select("id")
      .single();
    if (error || !inserted) { toast("error", `Submit failed: ${error?.message ?? "unknown"}`); return; }
    await supabase.from("ticket_messages").insert({
      ticket_id: inserted.id,
      author: "franchisee",
      author_name: franchisee.owner_name,
      body: form.description,
    });
    await load();
    setForm({ category: categories[0], subject: "", description: "" });
    toast("success", "Issue reported. HQ will respond within one business day.");
    setOpenTicketId(inserted.id);
  };

  const postReply = async () => {
    if (!openTicketId) return;
    if (!reply.trim()) { toast("error", "Write a reply first."); return; }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: openTicketId,
      author: "franchisee",
      author_name: franchisee.owner_name,
      body: reply.trim(),
    });
    if (error) { toast("error", `Reply failed: ${error.message}`); return; }
    // Any follow-up by the franchisee reopens a resolved ticket.
    const open = tickets.find((t) => t.id === openTicketId);
    if (open && open.status === "resolved") {
      await supabase.from("support_tickets").update({ status: "open" }).eq("id", openTicketId);
    }
    await load();
    setReply("");
    toast("success", "Reply sent.");
  };

  const openTicket = openTicketId ? tickets.find((t) => t.id === openTicketId) : null;
  const thread = openTicket
    ? messages.filter((m) => m.ticket_id === openTicket.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    : [];

  // Franchisee nudge — posts a highlighted "nudge" message to the thread
  // so HQ sees it in the admin inbox. Rate-limited via localStorage so a
  // frustrated franchisee doesn't spam admin with 20 nudges in a row.
  const nudgeHq = async () => {
    if (!openTicketId) return;
    const key = "cc.portal.ticket-nudge." + openTicketId;
    const last = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (last && Date.now() - new Date(last).getTime() < 2 * 60 * 60 * 1000) {
      const mins = Math.ceil((2 * 60 * 60 * 1000 - (Date.now() - new Date(last).getTime())) / 60_000);
      toast("info", `Already nudged HQ. You can nudge again in ~${mins} min.`);
      return;
    }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: openTicketId,
      author: "franchisee",
      author_name: franchisee.owner_name,
      body: "🔔 Nudge — still waiting on HQ. Please take a look when you can.",
    });
    if (error) { toast("error", `Nudge failed: ${error.message}`); return; }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, new Date().toISOString());
    }
    await load();
    toast("success", "HQ has been nudged.");
  };

  // Thread view takes over the page when a ticket is selected.
  if (openTicket) {
    return (
      <TicketThread
        ticket={openTicket}
        messages={thread}
        reply={reply}
        onReplyChange={setReply}
        onPostReply={postReply}
        onNudgeHq={nudgeHq}
        onBack={() => { setOpenTicketId(null); setReply(""); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Report an issue</CardTitle>
          <CardSubtitle>Someone at HQ responds within one business day.</CardSubtitle>
          <div className="mt-4 grid gap-4">
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
                placeholder="Short summary"
              />
            </label>
            <label>
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
                placeholder="Tell us what's happening"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[color:var(--color-border)] px-3 py-3 text-sm text-[color:var(--color-ink-soft)]">
              <Paperclip size={16} /> Attach photo (optional)
              <input type="file" className="hidden" />
            </label>
            <Button onClick={submit} className="self-start">Report issue</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Your stats</CardTitle>
          <div className="mt-4 space-y-3">
            <StatRow label="Open" value={tickets.filter((t) => t.status === "open").length} tone="warning" />
            <StatRow label="In progress" value={tickets.filter((t) => t.status === "in_progress").length} tone="brand" />
            <StatRow label="Resolved (lifetime)" value={tickets.filter((t) => t.status === "resolved").length} tone="success" />
          </div>
          <div className="mt-5 rounded-xl bg-[color:var(--color-brand-50)] px-3 py-3 text-[13px]">
            For urgent outlet-down issues, WhatsApp HQ at <b>+603-4256 7700</b>.
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Issue history</CardTitle>
        <CardSubtitle>Tap a row to read the full conversation with HQ. A NEW pill marks threads where HQ has replied since you last looked.</CardSubtitle>
        <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
          {sortedTickets.map((t) => {
            const msgs = messages.filter((m) => m.ticket_id === t.id);
            const msgCount = msgs.length;
            const lastMsg = [...msgs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
            // Latest HQ reply — the thing the franchisee actually wants to see.
            const latestHq = [...msgs].filter((m) => m.author === "hq").sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
            const seenRaw = typeof window !== "undefined"
              ? window.localStorage.getItem("cc.portal.ticket-seen." + t.id) : null;
            const seen = seenRaw ?? "1970-01-01";
            const isNew = !!latestHq && latestHq.created_at > seen;
            return (
              <li key={t.id}>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem("cc.portal.ticket-seen." + t.id, new Date().toISOString());
                    }
                    setOpenTicketId(t.id);
                  }}
                  className={
                    "flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-[color:var(--color-brand-50)]/40 " +
                    (isNew ? "bg-[color:var(--color-brand-50)]/40 -mx-3 px-3 rounded-xl" : "")
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isNew && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> New
                        </span>
                      )}
                      <span className="font-semibold">{t.subject}</span>
                      <Pill tone="neutral">{t.category}</Pill>
                    </div>
                    {lastMsg && (
                      <div className="mt-1 truncate text-[12px] text-[color:var(--color-ink-soft)]">
                        <b>{lastMsg.author === "hq" ? "HQ" : "You"}:</b> {lastMsg.body}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">
                      {formatDate(t.created_at)} · {msgCount} message{msgCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Pill tone={t.status === "resolved" ? "success" : t.status === "open" ? "warning" : "brand"}>
                    {t.status.replace("_", " ")}
                  </Pill>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function TicketThread({
  ticket, messages, reply, onReplyChange, onPostReply, onNudgeHq, onBack,
}: {
  ticket: SupportTicket;
  messages: TicketMessage[];
  reply: string;
  onReplyChange: (v: string) => void;
  onPostReply: () => void;
  onNudgeHq: () => void;
  onBack: () => void;
}) {
  // Hide Shell's generic "Back" pill while we're in a ticket thread —
  // the inline "Back to all issues" link is a clearer, context-aware
  // replacement. CSS selector lives in app/globals.css.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("cc-hide-shell-back");
    return () => { document.body.classList.remove("cc-hide-shell-back"); };
  }, []);
  // Figure out whether we're "waiting on HQ" — the latest message is from
  // the franchisee (or there are no messages yet after they opened it)
  // AND the ticket isn't resolved. Drives the waiting banner + nudge
  // button so HQ slippage becomes visible instead of silent.
  const latest = messages[messages.length - 1];
  const lastFranchiseeTs = latest && latest.author === "franchisee"
    ? latest.created_at
    : ticket.status !== "resolved" && messages.length === 0
    ? ticket.created_at
    : null;
  const awaitingHq = !!lastFranchiseeTs && ticket.status !== "resolved";
  const waitingMs = lastFranchiseeTs ? Date.now() - new Date(lastFranchiseeTs).getTime() : 0;
  const waitingHours = Math.floor(waitingMs / (60 * 60 * 1000));
  const waitingDays = Math.floor(waitingHours / 24);
  const waitedLabel = waitingDays >= 1
    ? `${waitingDays} day${waitingDays === 1 ? "" : "s"}`
    : waitingHours >= 1
    ? `${waitingHours} hour${waitingHours === 1 ? "" : "s"}`
    : "less than an hour";
  // Only offer the nudge button when HQ has been silent for a meaningful
  // window — not right after the franchisee just posted.
  const canNudge = awaitingHq && waitingHours >= 4;
  // Tone escalates the longer HQ is silent.
  const bannerTone =
    waitingDays >= 2 ? "danger" : waitingHours >= 8 ? "warning" : "info";
  const bannerClasses =
    bannerTone === "danger"
      ? "border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
      : bannerTone === "warning"
      ? "border-[color:var(--color-warning)] bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]"
      : "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]";

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        <ArrowLeft size={14} /> Back to all issues
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Pill tone="neutral">{ticket.category}</Pill>
              <Pill tone={ticket.status === "resolved" ? "success" : ticket.status === "open" ? "warning" : "brand"}>
                {ticket.status.replace("_", " ")}
              </Pill>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{ticket.subject}</h2>
            <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
              Opened {formatDate(ticket.created_at)}
            </div>
          </div>
        </div>
      </Card>

      {awaitingHq && (
        <div className={"flex flex-col gap-2 rounded-[14px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between " + bannerClasses}>
          <div className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 shrink-0" />
            <div className="text-[13px]">
              <div className="font-semibold">
                Waiting on HQ · {waitedLabel}
              </div>
              <div className="opacity-80">
                {waitingDays >= 2
                  ? "HQ is overdue on this. Tap Nudge HQ to ping them again."
                  : waitingHours >= 4
                  ? "No reply yet — you can nudge HQ from here."
                  : "HQ usually responds within a business day."}
              </div>
            </div>
          </div>
          {canNudge && (
            <Button size="sm" variant="outline" onClick={onNudgeHq}>
              <BellRing size={14} /> Nudge HQ
            </Button>
          )}
        </div>
      )}

      <Card className="!p-0">
        <ul className="divide-y divide-[color:var(--color-border)]">
          {messages.map((m) => {
            const isHq = m.author === "hq";
            return (
              <li key={m.id} className={"p-4 " + (isHq ? "bg-[color:var(--color-brand-50)]/40" : "")}>
                <div className="flex items-start gap-3">
                  <div
                    className={
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                      (isHq
                        ? "bg-[color:var(--color-brand)] text-white"
                        : "bg-[color:var(--color-border)] text-[color:var(--color-ink-soft)]")
                    }
                  >
                    {isHq ? <ShieldCheck size={14} /> : <User size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-semibold">{m.author_name}</span>
                      {isHq && <Pill tone="brand">HQ</Pill>}
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-ink-soft)]">
                        <Clock size={10} /> {formatDate(m.created_at)}
                      </span>
                    </div>
                    <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {m.body}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardTitle>Reply</CardTitle>
        <CardSubtitle>
          {ticket.status === "resolved"
            ? "Sending a reply will reopen this issue."
            : "HQ gets notified the moment you send."}
        </CardSubtitle>
        <textarea
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
          rows={4}
          placeholder="Add more detail, send a follow-up, or confirm resolution…"
          className="mt-3 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[color:var(--color-brand)] focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[color:var(--color-ink-soft)]">
            <Paperclip size={14} /> Attach photo
            <input type="file" className="hidden" />
          </label>
          <Button onClick={onPostReply} className={reply.trim() ? "" : "opacity-60"}>
            <Send size={14} /> Send reply
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "brand" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
      <span className="text-sm text-[color:var(--color-ink-soft)]">{label}</span>
      <Pill tone={tone}>{value}</Pill>
    </div>
  );
}
