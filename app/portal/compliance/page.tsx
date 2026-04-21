"use client";

import { useEffect, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { mockAudits } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { formatDate } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CompliancePage() {
  const { outlet } = useCurrentOutlet();
  const storageKey = `cc.resolved.${outlet.id}`;

  const loadResolved = (): Record<string, number[]> => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  };

  const applyResolved = (resolved: Record<string, number[]>) =>
    mockAudits
      .filter((a) => a.outlet_id === outlet.id)
      .map((a) => {
        const idxs = resolved[a.id] ?? [];
        return {
          ...a,
          checklist_items: a.checklist_items.map((c, i) =>
            idxs.includes(i) ? { ...c, pass: true } : c
          ),
        };
      })
      .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1));

  const [audits, setAudits] = useState(applyResolved({}));

  useEffect(() => {
    setAudits(applyResolved(loadResolved()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet.id]);

  const toggleItem = (auditId: string, idx: number) => {
    const current = loadResolved();
    const list = current[auditId] ?? [];
    const next = list.includes(idx) ? list.filter((x) => x !== idx) : [...list, idx];
    const updated = { ...current, [auditId]: next };
    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    setAudits(applyResolved(updated));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Compliance timeline</CardTitle>
        <CardSubtitle>Every audit, every finding. Tick off resolved items as you fix them.</CardSubtitle>
      </Card>

      {audits.length === 0 && (
        <Card>
          <EmptyState title="No audits yet" description="This outlet hasn't been audited. HQ will schedule the first visit within 30 days of opening." />
        </Card>
      )}

      <div className="relative space-y-6 pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[color:var(--color-brand-100)]" />
        {audits.map((a) => {
          const tone = a.score >= 85 ? "success" : a.score >= 70 ? "warning" : "danger";
          return (
            <div key={a.id} className="relative">
              <span
                className="absolute -left-[22px] top-4 h-4 w-4 rounded-full border-4"
                style={{
                  borderColor:
                    tone === "success" ? "#3B6D11" : tone === "warning" ? "#854F0B" : "#A32D2D",
                  backgroundColor: "#fff",
                }}
              />
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="!mb-0">{formatDate(a.audit_date)}</CardTitle>
                      <Pill tone={tone}>Score {a.score}</Pill>
                      {a.risk_flag && <Pill tone="danger">Risk flag</Pill>}
                    </div>
                    <CardSubtitle>
                      Auditor {a.auditor} · Signed off by {a.signed_off_by ?? "—"}
                    </CardSubtitle>

                    <ul className="mt-4 space-y-2">
                      {a.checklist_items.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={
                                "flex h-6 w-6 items-center justify-center rounded-full " +
                                (c.pass
                                  ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                                  : "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]")
                              }
                            >
                              {c.pass ? <Check size={14} /> : <X size={14} />}
                            </span>
                            <span className={c.pass ? "text-sm text-[color:var(--color-ink-soft)] line-through" : "text-sm font-medium"}>
                              {c.item}
                            </span>
                          </div>
                          {!c.pass && (
                            <label className="flex items-center gap-2 text-[12px] font-medium">
                              Resolved?
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[color:var(--color-brand)]"
                                onChange={() => toggleItem(a.id, i)}
                              />
                            </label>
                          )}
                        </li>
                      ))}
                    </ul>
                    {a.notes && (
                      <p className="mt-3 rounded-xl bg-[color:var(--color-brand-50)] px-3 py-2 text-[13px]">{a.notes}</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
