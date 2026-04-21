"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockFranchisees, mockOutlets } from "@/lib/mock-data";
import { useToast } from "@/components/ui/Toast";
import { daysUntil, formatDate } from "@/lib/utils";
import type { Franchisee } from "@/lib/types";
import { Download, Pencil, ChevronRight } from "lucide-react";

export default function FranchiseesPage() {
  const toast = useToast();
  const [list, setList] = useState<Franchisee[]>(mockFranchisees);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Franchisee>>({});

  const startEdit = (f: Franchisee) => {
    setEditing(f.id);
    setDraft(f);
  };
  const save = () => {
    setList((prev) => prev.map((f) => (f.id === editing ? { ...f, ...draft } as Franchisee : f)));
    setEditing(null);
  };

  const exportCSV = () => {
    const rows = [
      ["business_name","owner_name","ic_number","contact","email","agreement_start","agreement_end","status"],
      ...list.map((f) => [f.business_name, f.owner_name, f.ic_number, f.contact, f.email ?? "", f.agreement_start, f.agreement_end, f.status]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `franchisees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("success", `Exported ${list.length} franchisees to CSV.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All franchisees</h2>
          <p className="text-[13px] text-[color:var(--color-ink-soft)]">Contracts expiring within 90 days are highlighted.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download size={16} /> Export CSV</Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Outlets</th>
              <th className="px-4 py-3">Contract ends</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => {
              const dLeft = daysUntil(f.agreement_end);
              const highlight = dLeft <= 30 ? "bg-[color:var(--color-danger-soft)]" : dLeft <= 90 ? "bg-[color:var(--color-warning-soft)]" : "";
              const outlets = mockOutlets.filter((o) => o.franchisee_id === f.id);
              const isEditing = editing === f.id;
              return (
                <tr key={f.id} className={`border-t border-[color:var(--color-border)] ${highlight}`}>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={draft.business_name ?? ""}
                        onChange={(e) => setDraft({ ...draft, business_name: e.target.value })}
                        className="w-full rounded-lg border border-[color:var(--color-border)] px-2 py-1"
                      />
                    ) : (
                      <Link href={`/admin/franchisees/${f.id}`} className="group inline-flex items-start gap-1.5">
                        <div>
                          <div className="font-medium text-[color:var(--color-ink)] group-hover:text-[color:var(--color-brand-700)] group-hover:underline">
                            {f.business_name}
                          </div>
                          <div className="text-[11px] text-[color:var(--color-ink-soft)]">IC {f.ic_number}</div>
                        </div>
                        <ChevronRight size={12} className="mt-1 text-[color:var(--color-ink-soft)] group-hover:text-[color:var(--color-brand-700)]" />
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={draft.owner_name ?? ""}
                        onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })}
                        className="w-full rounded-lg border border-[color:var(--color-border)] px-2 py-1"
                      />
                    ) : (
                      <>
                        <div>{f.owner_name}</div>
                        <div className="text-[11px] text-[color:var(--color-ink-soft)]">{f.contact}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {outlets.map((o) => (
                      <div key={o.id} className="text-[12px]">
                        <Link href={`/admin/outlets/${o.outlet_code}`} className="font-medium text-[color:var(--color-brand-700)] hover:underline">
                          {o.outlet_code}
                        </Link> · {o.state}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(f.agreement_end)}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{dLeft} days left</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Pill tone={f.status === "active" ? "success" : "warning"}>{f.status}</Pill>
                      {f.risk_flag && <Pill tone="danger">At risk</Pill>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" onClick={save}>Save</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(f)}><Pencil size={14}/> Edit</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
