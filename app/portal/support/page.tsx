"use client";

import { useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockTickets, mockTicketMessages } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { SupportTicket, TicketMessage } from "@/lib/types";
import { Paperclip, Send, ArrowLeft, ShieldCheck, User, Clock } from "lucide-react";

const categories = ["IT / POS", "Supply Chain", "Marketing", "HR / Staffing", "Facility", "Other"];

export default function SupportPage() {
  const { outlet, franchisee } = useCurrentOutlet();
  const toast = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>(mockTickets);
  const [messages, setMessages] = useState<TicketMessage[]>(mockTicketMessages);
  const [form, setForm] = useState({ category: categories[0], subject: "", description: "" });
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [tickets]
  );

  const submit = () => {
    if (!form.subject.trim()) {
      toast("error", "Please add a short subject.");
      return;
    }
    if (form.description.trim().length < 10) {
      toast("error", "Please describe the issue in at least 10 characters.");
      return;
    }
    const id = "tk-new-" + Date.now();
    const t: SupportTicket = {
      id,
      outlet_id: outlet.id,
      category: form.category,
      subject: form.subject,
      description: form.description,
      photo_url: null,
      status: "open",
      created_at: new Date().toISOString(),
    };
    const firstMsg: TicketMessage = {
      id: "tm-new-" + Date.now(),
      ticket_id: id,
      author: "franchisee",
      author_name: franchisee.owner_name,
      body: form.description,
      created_at: new Date().toISOString(),
    };
    setTickets([t, ...tickets]);
    setMessages([...messages, firstMsg]);
    setForm({ category: categories[0], subject: "", description: "" });
    toast("success", "Ticket submitted. HQ will respond within one business day.");
    setOpenTicketId(id);
  };

  const postReply = () => {
    if (!openTicketId || !reply.trim()) return;
    const msg: TicketMessage = {
      id: "tm-new-" + Date.now(),
      ticket_id: openTicketId,
      author: "franchisee",
      author_name: franchisee.owner_name,
      body: reply.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages([...messages, msg]);
    setReply("");
    // Any follow-up by the franchisee reopens a resolved ticket.
    setTickets((prev) => prev.map((t) => (t.id === openTicketId && t.status === "resolved" ? { ...t, status: "open" } : t)));
    toast("success", "Reply sent.");
  };

  const openTicket = openTicketId ? tickets.find((t) => t.id === openTicketId) : null;
  const thread = openTicket
    ? messages.filter((m) => m.ticket_id === openTicket.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    : [];

  // Thread view takes over the page when a ticket is selected.
  if (openTicket) {
    return (
      <TicketThread
        ticket={openTicket}
        messages={thread}
        reply={reply}
        onReplyChange={setReply}
        onPostReply={postReply}
        onBack={() => { setOpenTicketId(null); setReply(""); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>Open a new ticket</CardTitle>
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
            <Button onClick={submit} className="self-start">Submit ticket</Button>
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
        <CardTitle>Ticket history</CardTitle>
        <CardSubtitle>Tap a row to read the full conversation with HQ.</CardSubtitle>
        <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
          {sortedTickets.map((t) => {
            const msgCount = messages.filter((m) => m.ticket_id === t.id).length;
            const lastMsg = messages
              .filter((m) => m.ticket_id === t.id)
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
            return (
              <li key={t.id}>
                <button
                  onClick={() => setOpenTicketId(t.id)}
                  className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-[color:var(--color-brand-50)]/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
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
  ticket, messages, reply, onReplyChange, onPostReply, onBack,
}: {
  ticket: SupportTicket;
  messages: TicketMessage[];
  reply: string;
  onReplyChange: (v: string) => void;
  onPostReply: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
      >
        <ArrowLeft size={14} /> Back to all tickets
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
            ? "Sending a reply will reopen this ticket."
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
          <Button onClick={onPostReply} disabled={!reply.trim()}>
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
