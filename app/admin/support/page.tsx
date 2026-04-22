"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupportTicket, TicketMessage, Outlet, Franchisee } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, ShieldCheck, User, Send, Clock, Search, Check } from "lucide-react";

export default function AdminSupportPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [filter, setFilter] = useState<"all" | SupportTicket["status"]>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ts }, { data: outs }, { data: fs }] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id, outlet_id, category, subject, description, photo_url, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("outlets").select("*").order("outlet_code"),
      supabase.from("franchisees").select("*"),
    ]);
    const ticketRows = (ts ?? []) as SupportTicket[];
    setTickets(ticketRows);
    setOutlets((outs ?? []) as Outlet[]);
    setFranchisees((fs ?? []) as Franchisee[]);
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
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  // Convenience lookup helpers — resolve outlet + owner for each ticket row.
  const outletFor = (oid: string | null) => outlets.find((o) => o.id === oid);
  const franchiseeFor = (oid: string | null) => {
    const o = outletFor(oid);
    return o ? franchisees.find((f) => f.id === o.franchisee_id) : undefined;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((t) => (filter === "all" ? true : t.status === filter))
      .filter((t) => {
        if (!q) return true;
        const o = outletFor(t.outlet_id);
        const f = franchiseeFor(t.outlet_id);
        return (
          t.subject.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (o?.outlet_code ?? "").toLowerCase().includes(q) ||
          (o?.location ?? "").toLowerCase().includes(q) ||
          (f?.owner_name ?? "").toLowerCase().includes(q)
        );
      });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tickets, filter, query, outlets, franchisees]);

  const counts = useMemo(() => {
    const base: Record<"all" | SupportTicket["status"], number> = {
      all: tickets.length, open: 0, in_progress: 0, resolved: 0,
    };
    for (const t of tickets) base[t.status] += 1;
    return base;
  }, [tickets]);

  const postReply = async () => {
    if (!openId || !reply.trim() || !profile) return;
    setPosting(true);
    try {
      const { error: msgErr } = await supabase.from("ticket_messages").insert({
        ticket_id: openId,
        author: "hq",
        author_name: profile.full_name ?? profile.email ?? "HQ",
        body: reply.trim(),
      });
      if (msgErr) throw new Error(msgErr.message);
      // Any HQ reply moves an open ticket to in_progress so the franchisee's
      // support badge turns red and they know HQ is actively working on it.
      const ticket = tickets.find((t) => t.id === openId);
      if (ticket && ticket.status === "open") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", openId);
      }
      await load();
      setReply("");
      toast("success", "Reply sent to franchisee.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Reply failed.");
    } finally {
      setPosting(false);
    }
  };

  const setStatus = async (id: string, next: SupportTicket["status"]) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: next, resolved_at: next === "resolved" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast("error", `Status update failed: ${error.message}`); return; }
    await load();
    toast("success", `Marked ${next.replace("_", " ")}.`);
  };

  const openTicket = openId ? tickets.find((t) => t.id === openId) ?? null : null;
  const thread = openTicket
    ? messages.filter((m) => m.ticket_id === openTicket.id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    : [];

  if (openTicket) {
    const o = outletFor(openTicket.outlet_id);
    const f = franchiseeFor(openTicket.outlet_id);
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setOpenId(null); setReply(""); }}
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ArrowLeft size={14} /> Back to all requests
        </button>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Pill tone="neutral">{openTicket.category}</Pill>
                <Pill tone={openTicket.status === "resolved" ? "success" : openTicket.status === "open" ? "warning" : "brand"}>
                  {openTicket.status.replace("_", " ")}
                </Pill>
              </div>
              <h2 className="mt-2 text-xl font-semibold">{openTicket.subject}</h2>
              <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">
                {o ? (
                  <Link href={`/admin/outlets/${o.outlet_code}`} className="font-medium text-[color:var(--color-brand-700)] hover:underline">
                    {o.outlet_code} · {o.location}
                  </Link>
                ) : "— no outlet —"}
                {f && <> · Owner {f.owner_name} · {f.contact}</>}
                <> · Opened {formatDate(openTicket.created_at)}</>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {openTicket.status !== "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(openTicket.id, "in_progress")}>
                  <Clock size={12} /> Mark in progress
                </Button>
              )}
              {openTicket.status !== "resolved" && (
                <Button size="sm" onClick={() => setStatus(openTicket.id, "resolved")}>
                  <Check size={12} /> Mark resolved
                </Button>
              )}
              {openTicket.status === "resolved" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(openTicket.id, "open")}>
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="!p-0">
          <ul className="divide-y divide-[color:var(--color-border)]">
            {thread.map((m) => {
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
                      <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>Reply as HQ</CardTitle>
          <CardSubtitle>The franchisee is notified in real time.</CardSubtitle>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Acknowledge the issue, ask clarifying questions, share the fix…"
            className="mt-3 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[color:var(--color-brand)] focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-end">
            <Button onClick={postReply} disabled={!reply.trim() || posting}>
              <Send size={14} /> {posting ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open" value={`${counts.open}`} tone={counts.open > 0 ? "warning" : "success"} sub="Awaiting first response" />
        <Kpi label="In progress" value={`${counts.in_progress}`} tone="brand" sub="HQ is on it" />
        <Kpi label="Resolved" value={`${counts.resolved}`} tone="success" sub="Lifetime" />
        <Kpi label="Total" value={`${counts.all}`} sub="Across all outlets" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Franchisee requests</CardTitle>
            <CardSubtitle>Sorted by newest. Click one to read the thread and reply.</CardSubtitle>
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-soft)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Outlet, owner, subject…"
              className="w-64 rounded-full border border-[color:var(--color-border)] bg-white py-1.5 pl-8 pr-3 text-sm focus:border-[color:var(--color-brand)] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors " +
                (filter === s
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                  : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand-200)]")
              }
            >
              {s === "all" ? "All" : s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}
              <span className={"rounded-full px-1.5 text-[10px] font-semibold " + (filter === s ? "bg-white/20" : "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]")}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-sm text-[color:var(--color-ink-soft)]">
            No requests match this filter.
          </div>
        </Card>
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-[color:var(--color-border)]">
            {filtered.map((t) => {
              const msgs = messages.filter((m) => m.ticket_id === t.id);
              const lastMsg = msgs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
              const o = outletFor(t.outlet_id);
              const f = franchiseeFor(t.outlet_id);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setOpenId(t.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-brand-50)]/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{t.subject}</span>
                        <Pill tone="neutral">{t.category}</Pill>
                        {o && <span className="text-[12px] text-[color:var(--color-brand-700)] font-medium">{o.outlet_code}</span>}
                      </div>
                      <div className="mt-1 truncate text-[12px] text-[color:var(--color-ink-soft)]">
                        {f?.owner_name ?? "—"} · {o?.location ?? "—"}
                      </div>
                      {lastMsg && (
                        <div className="mt-1 truncate text-[12px] text-[color:var(--color-ink-soft)]">
                          <b>{lastMsg.author === "hq" ? "HQ" : "Franchisee"}:</b> {lastMsg.body}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">
                        {formatDate(t.created_at)} · {msgs.length} message{msgs.length !== 1 ? "s" : ""}
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
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "warning" | "danger" | "brand" }) {
  const cls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : "";
  return (
    <Card>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-2 text-[22px] font-semibold " + cls}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
}
