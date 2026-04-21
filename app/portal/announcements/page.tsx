"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { mockAnnouncements } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Pin } from "lucide-react";
import type { Announcement } from "@/lib/types";

export default function AnnouncementsPage() {
  const [reads, setReads] = useState<Set<string>>(new Set());

  const pinned = mockAnnouncements.filter((a) => a.pinned);
  const rest = mockAnnouncements
    .filter((a) => !a.pinned)
    .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1));

  const markRead = (id: string) => setReads((prev) => new Set([...prev, id]));

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
      {pinned.length > 0 && (
        <section>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            Pinned
          </div>
          <div className="space-y-4">{pinned.map(renderCard)}</div>
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
