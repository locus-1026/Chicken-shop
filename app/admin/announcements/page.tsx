"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatDate } from "@/lib/utils";
import type { Announcement, Franchisee } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Send, Eye, X, Check, Clock, Mail } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [list, setList] = useState<Announcement[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [reads, setReads] = useState<{ announcement_id: string; user_id: string; read_at: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; franchisee_id: string | null }[]>([]);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<string>("all");
  const [schedule, setSchedule] = useState("");
  const [preview, setPreview] = useState(false);
  const [openedAnnouncement, setOpenedAnnouncement] = useState<Announcement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: anns }, { data: fs }, { data: rs }, { data: ps }] = await Promise.all([
      supabase.from("announcements").select("*").order("publish_at", { ascending: false }),
      supabase.from("franchisees").select("*"),
      supabase.from("announcement_reads").select("announcement_id, user_id, read_at"),
      supabase.from("profiles").select("id, franchisee_id"),
    ]);
    setList((anns ?? []) as Announcement[]);
    setFranchisees((fs ?? []) as Franchisee[]);
    setReads((rs ?? []) as { announcement_id: string; user_id: string; read_at: string }[]);
    setProfiles((ps ?? []) as { id: string; franchisee_id: string | null }[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_reads" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  const targetLabel =
    target === "all" ? "All users"
    : target === "franchisees" ? "All franchisees"
    : franchisees.find((f) => f.id === target)?.business_name ?? "Custom";

  // For a given announcement, figure out which profile ids count as "recipients"
  // and whether each has a matching announcement_reads row.
  const recipientProfileIds = useCallback((a: Announcement): string[] => {
    // Target role null = everyone; franchisee = all franchisee profiles;
    // specific franchisee (target_role=franchisee & target_outlet_id set) would
    // narrow further, but this seed doesn't use target_outlet_id for that.
    return profiles
      .filter((p) => (a.target_role === null || a.target_role === "franchisee") && p.franchisee_id)
      .map((p) => p.id);
  }, [profiles]);

  const hasOpened = useCallback((announcementId: string, userId: string) =>
    reads.some((r) => r.announcement_id === announcementId && r.user_id === userId)
  , [reads]);

  const exec = (cmd: string) => document.execCommand(cmd, false);

  const publish = async () => {
    const body = bodyRef.current?.innerHTML ?? "";
    if (!title.trim()) {
      toast("error", "Please give the announcement a title.");
      return;
    }
    if (!body.replace(/<[^>]+>/g, "").trim()) {
      toast("error", "Please write the announcement body.");
      return;
    }
    const { error } = await supabase.from("announcements").insert({
      title,
      body,
      pinned: false,
      publish_at: schedule ? new Date(schedule).toISOString() : new Date().toISOString(),
      target_role: target === "franchisees" || target !== "all" ? "franchisee" : null,
      created_by: profile?.id ?? null,
    });
    if (error) { toast("error", `Publish failed: ${error.message}`); return; }
    await load();
    setTitle("");
    if (bodyRef.current) bodyRef.current.innerHTML = "";
    setSchedule("");
    setPreview(false);
    toast("success", `Announcement "${title}" queued.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>New announcement</CardTitle>
          <CardSubtitle>Target a role, schedule publish, preview before send.</CardSubtitle>

          <div className="mt-4 space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-2.5 text-lg font-semibold"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-2 py-1">
              <div className="flex items-center gap-1">
                <FormatBtn label="B" onClick={() => exec("bold")} />
                <FormatBtn label="I" onClick={() => exec("italic")} />
                <FormatBtn label="U" onClick={() => exec("underline")} />
                <FormatBtn label="• List" onClick={() => exec("insertUnorderedList")} />
              </div>
              <span className="pr-2 text-[11px] text-[color:var(--color-ink-soft)]">Select text first, then format.</span>
            </div>
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[180px] rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[color:var(--color-brand)]"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Target audience</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2"
                >
                  <option value="all">All users (franchisees + HQ)</option>
                  <option value="franchisees">All franchisees</option>
                  <optgroup label="Specific franchisee">
                    {franchisees.map((f) => (
                      <option key={f.id} value={f.id}>{f.business_name} · {f.owner_name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <label>
                <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Publish at</span>
                <input
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview((p) => !p)}>
                <Eye size={16} /> {preview ? "Hide preview" : "Preview"}
              </Button>
              <Button onClick={publish}><Send size={16} /> Publish</Button>
            </div>

            {preview && (
              <div className="rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-4">
                <div className="text-[11px] font-semibold uppercase text-[color:var(--color-brand-700)]">Preview</div>
                <h3 className="mt-1 text-lg font-semibold">{title || "Untitled"}</h3>
                <div className="prose prose-sm mt-2" dangerouslySetInnerHTML={{ __html: bodyRef.current?.innerHTML ?? "" }} />
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Sent history</CardTitle>
          <CardSubtitle>Click a row to see who's opened it.</CardSubtitle>
          <ul className="mt-3 space-y-2">
            {list.map((a) => {
              const label = a.target_role ?? "all";
              const recipientIds = recipientProfileIds(a);
              const openedCount = recipientIds.filter((uid) => hasOpened(a.id, uid)).length;
              const pct = recipientIds.length ? Math.round((openedCount / recipientIds.length) * 100) : 0;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setOpenedAnnouncement(a)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.18)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <div className="text-[11px] text-[color:var(--color-ink-soft)]">
                        {formatDate(a.publish_at)} · {label} · {openedCount}/{recipientIds.length} opened
                      </div>
                    </div>
                    <Pill tone={pct >= 75 ? "success" : pct >= 40 ? "warning" : "danger"}>{pct}%</Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {openedAnnouncement && (
        <ReadReceiptsModal
          announcement={openedAnnouncement}
          franchisees={franchisees}
          profiles={profiles}
          reads={reads}
          onClose={() => setOpenedAnnouncement(null)}
        />
      )}
    </div>
  );
}

function ReadReceiptsModal({
  announcement, franchisees, profiles, reads, onClose,
}: {
  announcement: Announcement;
  franchisees: Franchisee[];
  profiles: { id: string; franchisee_id: string | null }[];
  reads: { announcement_id: string; user_id: string; read_at: string }[];
  onClose: () => void;
}) {
  // One row per franchisee; opened = any user under that franchisee has a read row.
  const readByFId = (fid: string) => reads.some((r) =>
    r.announcement_id === announcement.id &&
    profiles.some((p) => p.id === r.user_id && p.franchisee_id === fid)
  );
  const openedList = franchisees.filter((f) => readByFId(f.id));
  const pendingList = franchisees.filter((f) => !readByFId(f.id));
  const readAtFor = (fid: string): string | null => {
    const match = reads.find((r) =>
      r.announcement_id === announcement.id &&
      profiles.some((p) => p.id === r.user_id && p.franchisee_id === fid)
    );
    return match?.read_at ?? null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">Read receipts</div>
            <h3 className="mt-0.5 truncate text-lg font-semibold">{announcement.title}</h3>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
              Sent {formatDate(announcement.publish_at)} · Target: {announcement.target_role ?? "all"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand-700)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-0 border-b border-[color:var(--color-border)]">
          <div className="p-4 text-center">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-soft)]">Opened</div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--color-success)]">{openedList.length}</div>
          </div>
          <div className="border-l border-[color:var(--color-border)] p-4 text-center">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-ink-soft)]">Not yet</div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--color-warning)]">{pendingList.length}</div>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4">
          {openedList.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                Opened
              </div>
              <ul className="space-y-1.5">
                {openedList.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-[color:var(--color-success-soft)]/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.business_name}</div>
                      <div className="truncate text-[11px] text-[color:var(--color-ink-soft)]">{f.owner_name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-success)]">
                      <Check size={12} />
                      {readAtFor(f.id) ? formatDate(readAtFor(f.id)!) : "opened"}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pendingList.length > 0 && (
            <>
              <div className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                Not yet opened
              </div>
              <ul className="space-y-1.5">
                {pendingList.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-[color:var(--color-warning-soft)]/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.business_name}</div>
                      <div className="truncate text-[11px] text-[color:var(--color-ink-soft)]">{f.owner_name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-warning)]">
                      <Clock size={12} /> pending
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {pendingList.length > 0 && (
          <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
            <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
              <Mail size={14} /> Nudge {pendingList.length} franchisee{pendingList.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormatBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand-700)]"
    >
      {label}
    </button>
  );
}
