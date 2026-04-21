"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { mockOutlets, mockRoyalties, mockFranchisees } from "@/lib/mock-data";
import { RM, RM2, formatDate, monthLabel } from "@/lib/utils";
import { calcRoyalty } from "@/lib/utils";
import { notifyRoyaltyDue } from "@/lib/mocks/notifications";
import { useToast } from "@/components/ui/Toast";
import type { Royalty } from "@/lib/types";
import { FileText, Check, AlertTriangle, X, Clock, Shield } from "lucide-react";

// Shape the franchisee-side uploads. Same key used on the portal royalty page.
type Proof = { fileName: string; reference: string; submittedAt: string };
type ProofsByRowId = Record<string, Proof>;
type PaidMap = Record<string, { paid_at: string }>; // rowId → payment timestamp

const PROOF_KEY = (outletId: string) => `cc.royalty-proofs.${outletId}`;
const PAID_KEY  = (outletId: string) => `cc.royalty-paid.${outletId}`;

export default function AdminRoyaltiesPage() {
  const toast = useToast();
  const periods = [...new Set(mockRoyalties.map((r) => r.period))].sort().reverse();
  const [period, setPeriod] = useState(periods[0]);
  const [rows, setRows] = useState<Royalty[]>(mockRoyalties);
  // Proofs uploaded by franchisees, keyed by royalty row id, across every outlet.
  const [proofs, setProofs] = useState<ProofsByRowId>({});
  const [verifying, setVerifying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // no-proof confirmation

  // Scan every localStorage key under our prefixes — not just mock outlet ids —
  // so proofs/payments stored under Supabase UUIDs from older sessions still
  // appear to HQ. Belt-and-braces in case a franchisee hasn't triggered the
  // client-side migration yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mergedProofs: ProofsByRowId = {};
    const paidRows: PaidMap = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        if (k.startsWith("cc.royalty-proofs.")) {
          Object.assign(mergedProofs, JSON.parse(raw) as ProofsByRowId);
        } else if (k.startsWith("cc.royalty-paid.")) {
          Object.assign(paidRows, JSON.parse(raw) as PaidMap);
        }
      } catch {
        /* ignore malformed entries */
      }
    }
    setProofs(mergedProofs);
    if (Object.keys(paidRows).length > 0) {
      setRows((prev) =>
        prev.map((r) =>
          paidRows[r.id] ? { ...r, status: "paid", paid_at: paidRows[r.id].paid_at } : r
        )
      );
    }
  }, []);

  // Persist a paid row so franchisee sees "Paid" on their side.
  const persistPaid = (rowId: string, outletId: string, paid_at: string) => {
    if (typeof window === "undefined") return;
    const key = PAID_KEY(outletId);
    const raw = window.localStorage.getItem(key);
    let map: PaidMap = {};
    try { map = raw ? JSON.parse(raw) : {}; } catch { map = {}; }
    map[rowId] = { paid_at };
    window.localStorage.setItem(key, JSON.stringify(map));
  };

  const removeProof = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || typeof window === "undefined") return;
    const key = PROOF_KEY(row.outlet_id);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const map = JSON.parse(raw) as ProofsByRowId;
      delete map[rowId];
      window.localStorage.setItem(key, JSON.stringify(map));
    } catch {
      // noop
    }
    setProofs((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const filtered = useMemo(() => rows.filter((r) => r.period === period), [rows, period]);

  const editGross = (id: string, g: number) => {
    const c = calcRoyalty(g);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, gross_sales: g, royalty_amount: c.royalty, marketing_fee: c.marketing } : r)));
  };

  const markPaid = (id: string) => {
    const paid_at = new Date().toISOString();
    const row = rows.find((r) => r.id === id);
    if (row) persistPaid(id, row.outlet_id, paid_at);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid", paid_at } : r)));
    toast("success", "Marked as paid.");
  };

  const confirmFromProof = (id: string) => {
    const proof = proofs[id];
    markPaid(id);
    removeProof(id);
    setVerifying(null);
    toast("success", `Confirmed — ref ${proof?.reference ?? ""}. Franchisee notified.`);
  };

  const forcePaidNoProof = (id: string) => {
    markPaid(id);
    setConfirming(null);
    toast("info", "Marked paid without an uploaded slip — noted on record.");
  };

  const sendReminders = async () => {
    const outstanding = filtered.filter((x) => x.status !== "paid");
    if (outstanding.length === 0) {
      toast("info", "No outstanding royalties for this month.");
      return;
    }
    for (const r of outstanding) {
      const outlet = mockOutlets.find((o) => o.id === r.outlet_id)!;
      const f = mockFranchisees.find((x) => x.id === outlet.franchisee_id)!;
      await notifyRoyaltyDue(outlet.outlet_code, f.email ?? "unknown@coco.my", r.royalty_amount + r.marketing_fee);
    }
    toast("success", `Sent ${outstanding.length} royalty reminders.`);
  };

  const markAllPaidWithToast = () => {
    const count = filtered.filter((r) => r.status !== "paid").length;
    if (count === 0) {
      toast("info", "Every royalty for this period is already settled.");
      return;
    }
    const paid_at = new Date().toISOString();
    // Persist each row's paid state so franchisees see the update.
    filtered.forEach((r) => {
      if (r.status !== "paid") persistPaid(r.id, r.outlet_id, paid_at);
    });
    setRows((prev) =>
      prev.map((r) =>
        r.period === period && r.status !== "paid"
          ? { ...r, status: "paid", paid_at }
          : r
      )
    );
    toast("success", `Marked ${count} royalties as paid.`);
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross_sales,
      due:   acc.due + r.royalty_amount + r.marketing_fee,
      paid:  acc.paid + (r.status === "paid" ? r.royalty_amount + r.marketing_fee : 0),
    }),
    { gross: 0, due: 0, paid: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Royalty statements</CardTitle>
          <CardSubtitle>Pick a month, edit gross sales, mark settlements.</CardSubtitle>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {periods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
          </select>
          <Button variant="outline" onClick={sendReminders}>Send reminders</Button>
          <Button onClick={markAllPaidWithToast}>Mark all paid</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Total gross</div><div className="mt-1 text-xl font-semibold">{RM(totals.gross)}</div></Card>
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Billed (roy + mkt)</div><div className="mt-1 text-xl font-semibold">{RM2(totals.due)}</div></Card>
        <Card><div className="text-[12px] text-[color:var(--color-ink-soft)]">Collected</div><div className="mt-1 text-xl font-semibold text-[color:var(--color-success)]">{RM2(totals.paid)}</div></Card>
        <Card>
          <div className="text-[12px] text-[color:var(--color-ink-soft)]">Awaiting my verification</div>
          <div className="mt-1 text-xl font-semibold text-[color:var(--color-brand-700)]">
            {filtered.filter((r) => r.status !== "paid" && proofs[r.id]).length}
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-brand-50)] text-left text-[12px] uppercase tracking-wide text-[color:var(--color-brand-700)]">
            <tr>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Gross sales</th>
              <th className="px-4 py-3">Royalty 5%</th>
              <th className="px-4 py-3">Marketing 2%</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Proof of payment</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const outlet = mockOutlets.find((o) => o.id === r.outlet_id)!;
              const proof = proofs[r.id];
              const awaitingHQ = r.status !== "paid" && !!proof;
              const displayStatus: "paid" | "awaiting" | "overdue" | "pending" =
                r.status === "paid" ? "paid"
                : awaitingHQ ? "awaiting"
                : r.status === "overdue" ? "overdue"
                : "pending";

              return (
                <tr key={r.id} className="border-t border-[color:var(--color-border)] align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{outlet.outlet_code}</div>
                    <div className="text-[11px] text-[color:var(--color-ink-soft)]">{outlet.location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={r.gross_sales}
                      onChange={(e) => editGross(r.id, Number(e.target.value))}
                      className="w-32 rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-4 py-3">{RM2(r.royalty_amount)}</td>
                  <td className="px-4 py-3">{RM2(r.marketing_fee)}</td>
                  <td className="px-4 py-3 font-semibold">{RM2(r.royalty_amount + r.marketing_fee)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={displayStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {proof ? (
                      <button
                        onClick={() => setVerifying(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:bg-[color:var(--color-brand-100)]"
                        title="View uploaded slip"
                      >
                        <FileText size={12} /> {proof.reference || "View slip"}
                      </button>
                    ) : r.status === "paid" ? (
                      <span className="text-[11px] text-[color:var(--color-ink-soft)]">
                        Confirmed by HQ
                        {r.paid_at && <> · {formatDate(r.paid_at)}</>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-ink-soft)]">
                        <AlertTriangle size={10} /> No slip uploaded
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status !== "paid" && (
                      proof ? (
                        <Button size="sm" variant="success" onClick={() => setVerifying(r.id)}>
                          <Shield size={12} /> Verify & confirm
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirming(r.id)}>
                          Mark paid (no slip)
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {verifying && (() => {
        const row = rows.find((r) => r.id === verifying);
        const outlet = row ? mockOutlets.find((o) => o.id === row.outlet_id) : null;
        const proof = proofs[verifying];
        if (!row || !outlet || !proof) return null;
        return (
          <VerifyProofModal
            outletCode={outlet.outlet_code}
            month={monthLabel(row.period)}
            amount={RM2(row.royalty_amount + row.marketing_fee)}
            bankRef={`Maybank 5142 1234 5678 · ref ${outlet.outlet_code}`}
            proof={proof}
            onClose={() => setVerifying(null)}
            onConfirm={() => confirmFromProof(row.id)}
            onReject={() => {
              removeProof(row.id);
              setVerifying(null);
              toast("info", "Slip rejected. Franchisee will need to re-upload.");
            }}
          />
        );
      })()}

      {confirming && (() => {
        const row = rows.find((r) => r.id === confirming);
        const outlet = row ? mockOutlets.find((o) => o.id === row.outlet_id) : null;
        if (!row || !outlet) return null;
        return (
          <NoProofConfirmModal
            outletCode={outlet.outlet_code}
            month={monthLabel(row.period)}
            amount={RM2(row.royalty_amount + row.marketing_fee)}
            onClose={() => setConfirming(null)}
            onConfirm={() => forcePaidNoProof(row.id)}
          />
        );
      })()}
    </div>
  );
}

function StatusPill({ status }: { status: "paid" | "awaiting" | "overdue" | "pending" }) {
  if (status === "paid")     return <Pill tone="success"><Check size={12} /> Paid</Pill>;
  if (status === "awaiting") return <Pill tone="brand"><Clock size={12} /> Awaiting HQ</Pill>;
  if (status === "overdue")  return <Pill tone="danger"><AlertTriangle size={12} /> Overdue</Pill>;
  return <Pill tone="warning"><Clock size={12} /> Pending</Pill>;
}

function VerifyProofModal({
  outletCode, month, amount, bankRef, proof, onClose, onConfirm, onReject,
}: {
  outletCode: string;
  month: string;
  amount: string;
  bankRef: string;
  proof: Proof;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
              Verify payment slip
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{outletCode} · {month}</h3>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">Expected: <b>{amount}</b></div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4 text-center">
            <FileText size={28} className="mx-auto mb-2 text-[color:var(--color-brand)]" />
            <div className="text-sm font-semibold">{proof.fileName}</div>
            <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">Uploaded {formatDate(proof.submittedAt)}</div>
          </div>

          <DetailRow label="Bank reference" value={<span className="font-mono">{proof.reference}</span>} />
          <DetailRow label="Expected credit into" value={bankRef} />

          <div className="rounded-xl bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[12px] text-[color:var(--color-brand-700)]">
            Cross-check this against Maybank2E before confirming. Once confirmed the franchisee is notified and the statement closes.
          </div>
        </div>

        <div className="flex justify-between gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onReject}>
            Reject slip
          </Button>
          <Button onClick={onConfirm}>
            <Check size={14} /> Confirm payment
          </Button>
        </div>
      </div>
    </div>
  );
}

function NoProofConfirmModal({
  outletCode, month, amount, onClose, onConfirm,
}: {
  outletCode: string;
  month: string;
  amount: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-danger)]">
              Mark paid without proof
            </div>
            <h3 className="mt-0.5 text-lg font-semibold">{outletCode} · {month}</h3>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">Expected: <b>{amount}</b></div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5 text-sm">
          <div className="rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-3 text-[12px] text-[color:var(--color-danger)]">
            <div className="font-semibold">No slip was uploaded by the franchisee.</div>
            <div className="mt-1">Only proceed if you&apos;ve verified the credit directly in Maybank2E. This action is logged on the statement.</div>
          </div>
          <p className="text-[color:var(--color-ink-soft)]">
            Tip: ask the franchisee to upload a slip from their Royalty page — it closes the paper trail for both sides.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>I&apos;ve verified in Maybank2E</Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm">
      <span className="text-[12px] text-[color:var(--color-ink-soft)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
