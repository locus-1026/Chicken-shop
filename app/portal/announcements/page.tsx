"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { mockAnnouncements } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Pin } from "lucide-react";
import { useState } from "react";

export default function AnnouncementsPage() {
  const [reads, setReads] = useState<Set<string>>(new Set());
  const pinned = mockAnnouncements.filter((a) => a.pinned);
  const rest = mockAnnouncements
    .filter((a) => !a.pinned)
    .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1));

  const renderCard = (a: (typeof mockAnnouncements)[number]) => {
    const unread = !reads.has(a.id);
    return (
      <Card
        key={a.id}
        className={
          "relative " + (unread ? "!border-l-4 !border-l-[color:var(--color-brand)] !pl-5" : "")
        }
        onClick={() => setReads((r) => new Set([...r, a.id]))}
        interactive
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="!mb-1">{a.title}</CardTitle>
            <span className="text-[11px] text-[color:var(--color-ink-soft)]">{formatDate(a.publish_at)}</span>
          </div>
          <div className="flex gap-2">
            {a.pinned && <Pill tone="brand"><Pin size={12} /> Pinned</Pill>}
            {unread && <Pill tone="warning">New</Pill>}
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--color-ink)]">{a.body}</p>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {pinned.length > 0 && (
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            Pinned
          </div>
          <div className="space-y-4">{pinned.map(renderCard)}</div>
        </div>
      )}
      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          Recent
        </div>
        <div className="space-y-4">{rest.map(renderCard)}</div>
      </div>
    </div>
  );
}
