"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { DEMO_OUTLET_ID, mockAudits } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Check, X } from "lucide-react";

export default function CompliancePage() {
  const [audits, setAudits] = useState(
    mockAudits.filter((a) => a.outlet_id === DEMO_OUTLET_ID).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1))
  );

  const toggleItem = (auditId: string, idx: number) => {
    setAudits((prev) =>
      prev.map((a) =>
        a.id !== auditId
          ? a
          : {
              ...a,
              checklist_items: a.checklist_items.map((c, i) => (i === idx ? { ...c, pass: !c.pass } : c)),
            }
      )
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Compliance timeline</CardTitle>
        <CardSubtitle>Every audit, every finding. Tick off resolved items as you fix them.</CardSubtitle>
      </Card>

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
