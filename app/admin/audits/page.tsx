"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockAudits, mockOutlets } from "@/lib/mock-data";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { ComplianceAudit } from "@/lib/types";

const defaultChecklist = [
  "Food temperature logs up to date",
  "Staff in full uniform",
  "Back kitchen cleanliness",
  "Signage condition & branding",
  "POS till reconciliation",
  "First-aid kit complete",
];

const auditorOptions = [
  "HQ Ops — Tan Wei Ming",
  "HQ Ops — Mei Fong",
  "HQ Ops — Raj Kumar",
  "HQ Ops — Aisyah Abdullah",
  "External — SGS Malaysia",
];

export default function AdminAuditsPage() {
  const toast = useToast();
  const [audits, setAudits] = useState<ComplianceAudit[]>(mockAudits);
  const [show, setShow] = useState(false);
  const [outletId, setOutletId] = useState(mockOutlets[0].id);
  const [items, setItems] = useState(defaultChecklist.map((i) => ({ item: i, pass: true })));
  const [auditor, setAuditor] = useState(auditorOptions[0]);

  const score = Math.round((items.filter((i) => i.pass).length / items.length) * 100);

  const save = () => {
    if (!auditor || auditor.replace("HQ Ops —", "").trim().length < 2) {
      toast("error", "Please pick an auditor.");
      return;
    }
    const newA: ComplianceAudit = {
      id: "a-new-" + Date.now(),
      outlet_id: outletId,
      audit_date: new Date().toISOString().slice(0, 10),
      score,
      checklist_items: items,
      auditor,
      signed_off_by: "Chan Kok Weng",
      risk_flag: false,
      notes: null,
    };
    const prevTwo = audits.filter((a) => a.outlet_id === outletId).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)).slice(0, 1);
    if (prevTwo[0] && prevTwo[0].score < 80 && score < 80) newA.risk_flag = true;
    setAudits([newA, ...audits]);
    setShow(false);
    setItems(defaultChecklist.map((i) => ({ item: i, pass: true })));
    toast(newA.risk_flag ? "error" : "success", newA.risk_flag
      ? `Audit saved. Outlet flagged at risk — ${score}% after two sub-80 scores.`
      : `Audit saved — score ${score}%.`);
  };

  const atRiskIds = new Set<string>();
  mockOutlets.forEach((o) => {
    const last2 = audits.filter((a) => a.outlet_id === o.id).sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)).slice(0, 2);
    if (last2.length === 2 && last2[0].score < 80 && last2[1].score < 80) atRiskIds.add(o.id);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Compliance audits</CardTitle>
          <CardSubtitle>Two consecutive scores below 80 auto-flag the outlet.</CardSubtitle>
        </div>
        <Button onClick={() => setShow(true)}>New audit</Button>
      </div>

      {atRiskIds.size > 0 && (
        <Card className="!border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]">
          <CardTitle>Outlets at risk</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...atRiskIds].map((id) => {
              const o = mockOutlets.find((x) => x.id === id)!;
              return <Pill key={id} tone="danger">{o.outlet_code} · {o.location}</Pill>;
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Auditor</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Failures</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {audits.sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1)).map((a) => {
              const o = mockOutlets.find((x) => x.id === a.outlet_id);
              if (!o) return null;
              const tone = a.score >= 85 ? "success" : a.score >= 70 ? "warning" : "danger";
              return (
                <tr key={a.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-3">{formatDate(a.audit_date)}</td>
                  <td className="px-4 py-3"><div className="font-medium">{o.outlet_code}</div><div className="text-[11px] text-[color:var(--color-ink-soft)]">{o.location}</div></td>
                  <td className="px-4 py-3">{a.auditor}</td>
                  <td className="px-4 py-3"><Pill tone={tone}>{a.score}</Pill></td>
                  <td className="px-4 py-3">{a.checklist_items.filter((c) => !c.pass).length}</td>
                  <td className="px-4 py-3">{atRiskIds.has(a.outlet_id) && <Pill tone="danger">At risk</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-ink)]/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-5">
              <div>
                <h2 className="text-lg font-semibold">New audit</h2>
                <p className="text-[13px] text-[color:var(--color-ink-soft)]">Score auto-calculates as {score}%.</p>
              </div>
              <Button variant="ghost" onClick={() => setShow(false)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Outlet</span>
                  <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
                    {mockOutlets.map((o) => <option key={o.id} value={o.id}>{o.outlet_code} — {o.location}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Auditor</span>
                  <select value={auditor} onChange={(e) => setAuditor(e.target.value)} className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
                    {auditorOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <div className="mb-2 text-[12px] font-medium text-[color:var(--color-ink-soft)]">Checklist</div>
                <ul className="space-y-2">
                  {items.map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5">
                      <span className="text-sm">{c.item}</span>
                      <label className="flex items-center gap-2 text-[12px] font-medium">
                        <input
                          type="checkbox"
                          checked={c.pass}
                          onChange={() => setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, pass: !x.pass } : x)))}
                          className="h-4 w-4 accent-[color:var(--color-brand)]"
                        />
                        Pass
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[color:var(--color-border)] p-4">
              <Pill tone={score >= 85 ? "success" : score >= 70 ? "warning" : "danger"}>Score {score}%</Pill>
              <Button onClick={save}>Save audit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
