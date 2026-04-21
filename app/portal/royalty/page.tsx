"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { mockRoyalties, resolveMockOutletId } from "@/lib/mock-data";
import { useToast } from "@/components/ui/Toast";
import { RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import type { Royalty } from "@/lib/types";
import { Check, Clock, AlertCircle, Upload, FileText, X, Copy } from "lucide-react";

type Status = Royalty["status"];
const PROOF_KEY = (outletId: string) => `cc.royalty-proofs.${outletId}`;

type ProofMap = Record<string, { fileName: string; reference: string; submittedAt: string }>;

export default function RoyaltyPage() {
  const { outlet } = useCurrentOutlet();
  const toast = useToast();
  const [proofs, setProofs] = useState<ProofMap>({});
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Load persisted proofs for this outlet so refreshes keep the paper trail.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PROOF_KEY(outlet.id));
    setProofs(raw ? JSON.parse(raw) : {});
  }, [outlet.id]);

  const persist = (next: ProofMap) => {
    setProofs(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROOF_KEY(outlet.id), JSON.stringify(next));
    }
  };

  const mockOutletId = resolveMockOutletId(outlet);

  const rows = useMemo(
    () => mockRoyalties
      .filter((r) => r.outlet_id === mockOutletId)
      .sort((a, b) => (a.period < b.period ? 1 : -1)),
    [mockOutletId]
  );

  const effectiveStatus = (r: Royalty): Status => {
    if (r.status === "paid") return "paid";
    if (proofs[r.id]) return "submitted";
    if (daysUntil(r.due_date) < 0) return "overdue";
    return r.status;
  };

  const outstanding = rows
    .filter((r) => effectiveStatus(r) !== "paid")
    .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);

  const submitted = rows.filter((r) => effectiveStatus(r) === "submitted").length;
  const overdue   = rows.filter((r) => effectiveStatus(r) === "overdue").length;

  const active = rows.find((r) => r.id === activeRowId) ?? null;

  const handleUpload = (rowId: string, fileName: string, reference: string) => {
    persist({
      ...proofs,
      [rowId]: { fileName, reference, submittedAt: new Date().toISOString() },
    });
    setActiveRowId(null);
    toast("success", "Payment proof uploaded. HQ will confirm within one business day.");
  };

  const removeProof = (rowId: string) => {
    const next = { ...proofs };
    delete next[rowId];
    persist(next);
    toast("info", "Proof removed.");
  };

  const copyRef = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(outlet.outlet_code);
      toast("success", "Reference copied.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[color:var(--color-brand-50)] to-white !border-[color:var(--color-brand-200)]">
        <CardTitle>Royalty summary</CardTitle>
        <CardSubtitle>Royalty 5% of gross sales · Marketing levy 2% · Due 14th of the following month.</CardSubtitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SummaryBox label="Total outstanding" value={RM2(outstanding)} tone={outstanding > 0 ? "danger" : "success"} />
          <SummaryBox label="Awaiting HQ confirmation" value={`${submitted}`} tone={submitted > 0 ? "brand" : "neutral"} />
          <SummaryBox label="Overdue statements" value={`${overdue}`} tone={overdue > 0 ? "danger" : "success"} />
          <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3">
            <div className="text-[12px] text-[color:var(--color-ink-soft)]">Payment reference</div>
            <button
              onClick={copyRef}
              className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-[color:var(--color-brand-700)]"
              title="Copy to clipboard"
            >
              Maybank <b>5142 1234 5678</b> · <span className="font-mono">{outlet.outlet_code}</span>
              <Copy size={12} />
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Gross sales</th>
              <th className="px-4 py-3">Royalty 5%</th>
              <th className="px-4 py-3">Marketing 2%</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = effectiveStatus(r);
              const proof = proofs[r.id];
              return (
                <tr key={r.id} className="border-t border-[color:var(--color-border)] align-top">
                  <td className="px-4 py-3 font-medium">{monthLabel(r.period)}</td>
                  <td className="px-4 py-3">{RM2(r.gross_sales)}</td>
                  <td className="px-4 py-3">{RM2(r.royalty_amount)}</td>
                  <td className="px-4 py-3">{RM2(r.marketing_fee)}</td>
                  <td className="px-4 py-3 font-semibold">{RM2(r.royalty_amount + r.marketing_fee)}</td>
                  <td className="px-4 py-3">{formatDate(r.due_date)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={st} />
                    {proof && (
                      <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">
                        <FileText size={10} className="inline -mt-0.5" /> {proof.fileName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {st === "paid" ? (
                      <span className="text-[12px] text-[color:var(--color-success)]">
                        <Check size={12} className="inline -mt-0.5" /> Confirmed by HQ
                      </span>
                    ) : proof ? (
                      <button
                        onClick={() => removeProof(r.id)}
                        className="text-[12px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
                      >
                        Remove & re-upload
                      </button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setActiveRowId(r.id)}>
                        <Upload size={12} /> Upload proof
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {active && (
        <UploadProofModal
          statement={active}
          suggestedRef={outlet.outlet_code}
          onClose={() => setActiveRowId(null)}
          onSubmit={handleUpload}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "paid") return <Pill tone="success"><Check size={12} /> Paid</Pill>;
  if (status === "overdue") return <Pill tone="danger"><AlertCircle size={12} /> Overdue</Pill>;
  if (status === "submitted") return <Pill tone="brand"><Clock size={12} /> Awaiting HQ</Pill>;
  return <Pill tone="warning"><Clock size={12} /> Pending</Pill>;
}

function SummaryBox({ label, value, tone }: { label: string; value: string; tone: "danger" | "success" | "brand" | "neutral" }) {
  const cls =
    tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : "text-[color:var(--color-ink)]";
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3">
      <div className="text-[12px] text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-1 text-xl font-semibold " + cls}>{value}</div>
    </div>
  );
}

function UploadProofModal({
  statement, suggestedRef, onClose, onSubmit,
}: {
  statement: Royalty;
  suggestedRef: string;
  onClose: () => void;
  onSubmit: (rowId: string, fileName: string, reference: string) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [reference, setReference] = useState(suggestedRef);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">Upload proof of payment</div>
            <h3 className="mt-0.5 text-lg font-semibold">{monthLabel(statement.period)}</h3>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
              Total: <b>{RM2(statement.royalty_amount + statement.marketing_fee)}</b>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 py-6 text-center text-sm">
            <Upload size={24} className="text-[color:var(--color-brand)]" />
            <span className="font-medium">
              {fileName ?? "Tap to attach your bank slip (JPG/PNG/PDF)"}
            </span>
            {fileName && <span className="text-[11px] text-[color:var(--color-ink-soft)]">Tap again to change.</span>}
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => {
                const name = e.target.files?.[0]?.name;
                if (name) setFileName(name);
              }}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Bank reference / slip ID</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-sm"
              placeholder="e.g. MBB-20260421-0032"
            />
          </label>

          <div className="rounded-xl bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[12px] text-[color:var(--color-brand-700)]">
            After upload, this statement shows <b>Awaiting HQ</b>. Finance confirms within one business day — no more WhatsApp chases.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => fileName && reference.trim() && onSubmit(statement.id, fileName, reference.trim())}
            disabled={!fileName || !reference.trim()}
          >
            <Upload size={14} /> Submit proof
          </Button>
        </div>
      </div>
    </div>
  );
}
