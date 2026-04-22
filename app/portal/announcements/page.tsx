"use client";

import { useEffect, useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { mockAnnouncements } from "@/lib/mock-data";
import type { Royalty } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { formatDate, RM2, daysUntil } from "@/lib/utils";
import { Pin, Calendar, Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/types";

export default function AnnouncementsPage() {
  const { outlet } = useCurrentOutlet();
  const [reads, setReads] = useState<Set<string>>(new Set());

  // Fetch the nearest outstanding royalty for THIS outlet from Supabase so
  // the pinned card matches what /portal/royalty and HQ actually see.
  const [outstandingRoyalties, setOutstandingRoyalties] = useState<Royalty[]>([]);
  const [verifiedByRoyalty, setVerifiedByRoyalty] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
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
  }, [outlet.id]);
  const livePinned = useMemo(
    () => outstandingRoyalties.find((r) => !verifiedByRoyalty[r.id]) ?? null,
    [outstandingRoyalties, verifiedByRoyalty]
  );

  // Hide the forever-pinned welcome; everything else still flows normally.
  const otherAnnouncements = mockAnnouncements
    .filter((a) => a.id !== "an-1")
    .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1));
  const pinned = otherAnnouncements.filter((a) => a.pinned);
  const rest = otherAnnouncements.filter((a) => !a.pinned);

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
      <section>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          Pinned
        </div>
        <div className="space-y-4">
          <LivePinnedCard royalty={livePinned ?? undefined} outletCode={outlet.outlet_code} />
          {pinned.map(renderCard)}
        </div>
      </section>
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
