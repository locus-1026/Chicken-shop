"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { RM, RM2, formatDate, monthLabel } from "@/lib/utils";
import { calcRoyalty } from "@/lib/utils";
import { notifyRoyaltyDue } from "@/lib/mocks/notifications";
import { useToast } from "@/components/ui/Toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Royalty, Outlet, Franchisee } from "@/lib/types";
import { FileText, Check, AlertTriangle, X, Clock, Shield } from "lucide-react";

type Proof = {
  id: string;
  royalty_id: string;
  file_name: string;
  file_url: string | null;
  bank_reference: string;
  submitted_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
};

export default function AdminRoyaltiesPage() {
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<Royalty[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [proofs, setProofs] = useState<Record<string, Proof>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: royData, error: royErr },
      { data: outletData },
      { data: franchiseeData },
    ] = await Promise.all([
      // DB column is billing_period — alias so the Royalty type's `period` lines up.
      supabase
        .from("royalties")
        .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
        .order("billing_period", { ascending: false }),
      supabase.from("outlets").select("*").order("outlet_code"),
      supabase.from("franchisees").select("*"),
    ]);

    if (royErr) {
      toast("error", `Couldn't load royalties: ${royErr.message}`);
      setLoading(false);
      return;
    }
    const royalties = (royData ?? []) as Royalty[];
    setRows(royalties);
    setOutlets((outletData ?? []) as Outlet[]);
    setFranchisees((franchiseeData ?? []) as Franchisee[]);

    if (royalties.length > 0) {
      const { data: proofRows } = await supabase
        .from("royalty_proofs")
        .select("id, royalty_id, file_name, file_url, bank_reference, submitted_at, verified_at, rejected_at, rejected_reason")
        .in("royalty_id", royalties.map((r) => r.id));
      const map: Record<string, Proof> = {};
      for (const p of (proofRows ?? []) as Proof[]) map[p.royalty_id] = p;
      setProofs(map);
    }

    // Default to latest period on first load.
    if (!period && royalties.length > 0) {
      setPeriod(royalties[0].period);
    }
    setLoading(false);
  }, [supabase, toast, period]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-royalties")
      .on("postgres_changes", { event: "*", schema: "public", table: "royalties" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "royalty_proofs" }, load)
      .subscribe();
    const id = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); clearInterval(id); window.removeEventListener("focus", onFocus); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const periods = useMemo(
    () => [...new Set(rows.map((r) => r.period))].sort().reverse(),
    [rows]
  );

  const filtered = useMemo(
    () => {
      // Sort by outlet_code (CC-001, CC-002, ...) so the table reads naturally.
      const codeById: Record<string, string> = {};
      for (const o of outlets) codeById[o.id] = o.outlet_code;
      return rows
        .filter((r) => r.period === period)
        .sort((a, b) => (codeById[a.outlet_id] ?? "").localeCompare(codeById[b.outlet_id] ?? ""));
    },
    [rows, period, outlets]
  );

  const editGross = async (id: string, g: number) => {
    const c = calcRoyalty(g);
    // Update locally first for responsiveness, then persist.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, gross_sales: g, royalty_amount: c.royalty, marketing_fee: c.marketing } : r)));
    const { error } = await supabase
      .from("royalties")
      .update({ gross_sales: g })
      .eq("id", id);
    if (error) toast("error", `Save failed: ${error.message}`);
  };

  const markPaid = async (id: string) => {
    const paid_at = new Date().toISOString();
    const { error } = await supabase
      .from("royalties")
      .update({ status: "paid", paid_at })
      .eq("id", id);
    if (error) {
      toast("error", `Couldn't mark paid: ${error.message}`);
      return false;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid", paid_at } : r)));
    return true;
  };

  const confirmFromProof = async (id: string) => {
    const proof = proofs[id];
    if (!proof) return;
    // 1) Mark the proof verified.
    const { error: pErr } = await supabase
      .from("royalty_proofs")
      .update({ verified_at: new Date().toISOString(), rejected_at: null, rejected_reason: null })
      .eq("id", proof.id);
    if (pErr) { toast("error", `Verify failed: ${pErr.message}`); return; }
    // 2) Mark the royalty paid.
    const ok = await markPaid(id);
    if (!ok) return;
    // 3) Refresh proofs state so UI flips.
    setProofs((prev) => ({ ...prev, [id]: { ...proof, verified_at: new Date().toISOString(), rejected_at: null, rejected_reason: null } }));
    setVerifying(null);
    toast("success", `Confirmed — ref ${proof.bank_reference}. Franchisee will see Paid on refresh.`);
  };

  const rejectProof = async (id: string, reason: string) => {
    const proof = proofs[id];
    if (!proof) return;
    const { error } = await supabase
      .from("royalty_proofs")
      .update({ rejected_at: new Date().toISOString(), rejected_reason: reason, verified_at: null })
      .eq("id", proof.id);
    if (error) { toast("error", `Reject failed: ${error.message}`); return; }
    setProofs((prev) => ({ ...prev, [id]: { ...proof, rejected_at: new Date().toISOString(), rejected_reason: reason, verified_at: null } }));
    setVerifying(null);
    toast("info", "Slip rejected. Franchisee will need to re-upload.");
  };

  const forcePaidNoProof = async (id: string) => {
    const ok = await markPaid(id);
    if (ok) {
      setConfirming(null);
      toast("info", "Marked paid without an uploaded slip — noted on record.");
    }
  };

  const viewSlip = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("royalty-proofs")
      .createSignedUrl(filePath, 60 * 10); // 10 min
    if (error || !data) { toast("error", `Couldn't open slip: ${error?.message ?? "unknown"}`); return; }
    setSlipUrl(data.signedUrl);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const sendReminders = async () => {
    const outstanding = filtered.filter((x) => x.status !== "paid");
    if (outstanding.length === 0) {
      toast("info", "No outstanding royalties for this month.");
      return;
    }
    for (const r of outstanding) {
      const outlet = outlets.find((o) => o.id === r.outlet_id);
      if (!outlet) continue;
      const f = franchisees.find((x) => x.id === outlet.franchisee_id);
      await notifyRoyaltyDue(outlet.outlet_code, f?.email ?? "unknown@coco.my", r.royalty_amount + r.marketing_fee);
    }
    toast("success", `Sent ${outstanding.length} royalty reminders.`);
  };

  const markAllPaidWithToast = async () => {
    const unpaid = filtered.filter((r) => r.status !== "paid");
    if (unpaid.length === 0) {
      toast("info", "Every royalty for this period is already settled.");
      return;
    }
    const paid_at = new Date().toISOString();
    const { error } = await supabase
      .from("royalties")
      .update({ status: "paid", paid_at })
      .in("id", unpaid.map((r) => r.id));
    if (error) { toast("error", `Bulk update failed: ${error.message}`); return; }
    setRows((prev) => prev.map((r) => (unpaid.find((u) => u.id === r.id) ? { ...r, status: "paid", paid_at } : r)));
    toast("success", `Marked ${unpaid.length} royalties as paid.`);
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
            {filtered.filter((r) => r.status !== "paid" && proofs[r.id] && !proofs[r.id].rejected_at).length}
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
            {loading && filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--color-ink-soft)]">Loading statements…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--color-ink-soft)]">No statements for this period.</td></tr>
            ) : filtered.map((r) => {
              const outlet = outlets.find((o) => o.id === r.outlet_id);
              if (!outlet) return null;
              const proof = proofs[r.id];
              const activeProof = proof && !proof.rejected_at ? proof : null;
              const awaitingHQ = r.status !== "paid" && !!activeProof;
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
                      defaultValue={r.gross_sales}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== r.gross_sales) editGross(r.id, v);
                      }}
                      className="w-32 rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-4 py-3">{RM2(r.royalty_amount)}</td>
                  <td className="px-4 py-3">{RM2(r.marketing_fee)}</td>
                  <td className="px-4 py-3 font-semibold">{RM2(r.royalty_amount + r.marketing_fee)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={displayStatus} />
                    {proof?.rejected_at && (
                      <div className="mt-1 text-[11px] text-[color:var(--color-danger)]">Rejected — awaiting re-upload</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activeProof ? (
                      <button
                        onClick={() => setVerifying(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:bg-[color:var(--color-brand-100)]"
                        title="View uploaded slip"
                      >
                        <FileText size={12} /> {activeProof.bank_reference || "View slip"}
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
                      activeProof ? (
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
        const outlet = row ? outlets.find((o) => o.id === row.outlet_id) : null;
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
            onViewSlip={() => proof.file_url && viewSlip(proof.file_url)}
            onConfirm={() => confirmFromProof(row.id)}
            onReject={() => rejectProof(row.id, "Could not reconcile against Maybank2E")}
          />
        );
      })()}

      {confirming && (() => {
        const row = rows.find((r) => r.id === confirming);
        const outlet = row ? outlets.find((o) => o.id === row.outlet_id) : null;
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

      {/* slipUrl isn't rendered inline — we open in a new tab. Retained in state so future inline preview is one swap away. */}
      {slipUrl && null}
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
  outletCode, month, amount, bankRef, proof, onClose, onViewSlip, onConfirm, onReject,
}: {
  outletCode: string;
  month: string;
  amount: string;
  bankRef: string;
  proof: Proof;
  onClose: () => void;
  onViewSlip: () => void;
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
          <button
            onClick={onViewSlip}
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4 text-center hover:border-[color:var(--color-brand-300)]"
          >
            <FileText size={28} className="mx-auto mb-2 text-[color:var(--color-brand)]" />
            <div className="text-sm font-semibold">{proof.file_name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--color-ink-soft)]">Uploaded {formatDate(proof.submitted_at)} · click to open</div>
          </button>

          <DetailRow label="Bank reference" value={<span className="font-mono">{proof.bank_reference}</span>} />
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
