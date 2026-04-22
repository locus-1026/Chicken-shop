"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, PhoneCall, FileWarning } from "lucide-react";

export type ActionKind = "coach" | "notice";

export function ActionModal({
  subjectCode,
  ownerName,
  kind,
  onClose,
  onConfirm,
}: {
  // e.g. "CC-001" or "Coco Chick PJ Sdn Bhd"
  subjectCode: string;
  ownerName: string;
  kind: ActionKind;
  onClose: () => void;
  // Body is what the franchisee sees in their notification card.
  // Summary is the short toast HQ sees on their own screen.
  // When is the ISO datetime for coaching (empty for notices).
  onConfirm: (payload: { summary: string; body: string; when: string }) => void;
}) {
  const isCoach = kind === "coach";
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const defaultNote = isCoach
    ? `Hi ${ownerName.split(" ")[0]}, noticing ${subjectCode} tracking below target. Let's jump on a 30-min call to walk through operations and marketing support.`
    : `Formal notice: ${subjectCode} has been below compliance / sales threshold for a sustained period. Please respond with a recovery plan within 7 days. This goes on record per the franchise agreement.`;
  const [note, setNote] = useState(defaultNote);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div
              className={
                "text-[11px] font-semibold uppercase tracking-wider " +
                (isCoach ? "text-[color:var(--color-brand-700)]" : "text-[color:var(--color-danger)]")
              }
            >
              {isCoach ? "Schedule coaching call" : "Issue warning notice"}
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{subjectCode} · {ownerName}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isCoach && (
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">When</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">
              {isCoach ? "Message to franchisee" : "Notice content (goes on record)"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
            />
          </label>
          {!isCoach && (
            <div className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-2.5 text-[12px] text-[color:var(--color-danger)]">
              Warning notices are logged against the franchise agreement. Three active notices trigger a committee review.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const whenNice = isCoach
                ? new Date(when).toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
                : "";
              const body = isCoach
                ? `HQ would like to coach ${subjectCode} on ${whenNice}.\n\n${note}`
                : note;
              const summary = isCoach
                ? `Coaching call proposed for ${whenNice} with ${ownerName} (${subjectCode}).`
                : `Warning notice issued to ${subjectCode}. Franchisee and the agreement file have been notified.`;
              onConfirm({ summary, body, when: isCoach ? new Date(when).toISOString() : "" });
            }}
          >
            {isCoach ? (<><PhoneCall size={14} /> Send invite</>) : (<><FileWarning size={14} /> Issue notice</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
