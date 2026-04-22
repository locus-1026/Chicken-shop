"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { useToast } from "@/components/ui/Toast";
import { RM2, formatDate, monthLabel, daysUntil } from "@/lib/utils";
import type { Royalty } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Check, Clock, AlertCircle, Upload, FileText, X, Copy } from "lucide-react";

type Status = Royalty["status"];

// One row from public.royalty_proofs (joined into each statement row).
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

export default function RoyaltyPage() {
  const { outlet, franchisee } = useCurrentOutlet();
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<Royalty[]>([]);
  const [proofs, setProofs] = useState<Record<string, Proof>>({});
  const [loading, setLoading] = useState(true);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // RLS already filters royalties to this franchisee's outlets, but we narrow
    // by outlet_id so the user sees only the outlet they've picked in the switcher.
    // DB column is billing_period (date); we alias to `period` so the rest of
    // the UI (and the Royalty type) can use `period` untouched.
    const { data: royData, error: royErr } = await supabase
      .from("royalties")
      .select("id, outlet_id, gross_sales, royalty_amount, marketing_fee, due_date, paid_at, status, period:billing_period")
      .eq("outlet_id", outlet.id)
      .order("billing_period", { ascending: false });

    if (royErr) {
      toast("error", `Couldn't load royalties: ${royErr.message}`);
      setLoading(false);
      return;
    }
    const royalties = (royData ?? []) as Royalty[];
    setRows(royalties);

    if (royalties.length > 0) {
      const { data: proofRows, error: proofErr } = await supabase
        .from("royalty_proofs")
        .select("id, royalty_id, file_name, file_url, bank_reference, submitted_at, verified_at, rejected_at, rejected_reason")
        .in("royalty_id", royalties.map((r) => r.id));

      if (proofErr) {
        toast("error", `Couldn't load proofs: ${proofErr.message}`);
      } else {
        const map: Record<string, Proof> = {};
        for (const p of (proofRows ?? []) as Proof[]) map[p.royalty_id] = p;
        setProofs(map);
      }
    } else {
      setProofs({});
    }

    setLoading(false);
  }, [supabase, outlet.id, toast]);

  useEffect(() => { load(); }, [load]);

  const effectiveStatus = (r: Royalty): Status => {
    const p = proofs[r.id];
    if (r.status === "paid" || r.paid_at || (p && p.verified_at)) return "paid";
    if (p && !p.rejected_at) return "submitted";
    if (daysUntil(r.due_date) < 0) return "overdue";
    return r.status;
  };

  const outstanding = rows
    .filter((r) => effectiveStatus(r) !== "paid")
    .reduce((s, r) => s + r.royalty_amount + r.marketing_fee, 0);

  const submittedCount = rows.filter((r) => effectiveStatus(r) === "submitted").length;
  const overdueCount   = rows.filter((r) => effectiveStatus(r) === "overdue").length;

  const active = rows.find((r) => r.id === activeRowId) ?? null;

  const handleUpload = async (rowId: string, file: File, reference: string) => {
    setBusyRowId(rowId);
    try {
      // Path convention: <franchisee_id>/<royalty_id>/<timestamp>-<filename>
      // Storage RLS uses the first path segment for ownership.
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${franchisee.id}/${rowId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("royalty-proofs")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);

      // Insert (or replace — `unique(royalty_id)` enforces one active proof at a time).
      // If a prior rejected proof exists, delete it first.
      const existing = proofs[rowId];
      if (existing) {
        await supabase.from("royalty_proofs").delete().eq("id", existing.id);
      }

      const { error: insErr } = await supabase.from("royalty_proofs").insert({
        royalty_id: rowId,
        file_name: file.name,
        file_url: path,
        bank_reference: reference,
      });
      if (insErr) throw new Error(insErr.message);

      await load();
      setActiveRowId(null);
      toast("success", "Payment proof uploaded. HQ will confirm within one business day.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast("error", msg);
    } finally {
      setBusyRowId(null);
    }
  };

  const removeProof = async (rowId: string) => {
    const p = proofs[rowId];
    if (!p) return;
    setBusyRowId(rowId);
    try {
      if (p.file_url) {
        await supabase.storage.from("royalty-proofs").remove([p.file_url]);
      }
      const { error } = await supabase.from("royalty_proofs").delete().eq("id", p.id);
      if (error) throw new Error(error.message);
      await load();
      toast("info", "Proof removed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't remove proof.";
      toast("error", msg);
    } finally {
      setBusyRowId(null);
    }
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
          <SummaryBox label="Awaiting HQ confirmation" value={`${submittedCount}`} tone={submittedCount > 0 ? "brand" : "neutral"} />
          <SummaryBox label="Overdue statements" value={`${overdueCount}`} tone={overdueCount > 0 ? "danger" : "success"} />
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
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--color-ink-soft)]">Loading statements…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--color-ink-soft)]">No royalty statements yet.</td></tr>
            ) : rows.map((r) => {
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
                        <FileText size={10} className="inline -mt-0.5" /> {proof.file_name}
                      </div>
                    )}
                    {proof?.rejected_at && (
                      <div className="mt-1 text-[11px] text-[color:var(--color-danger)]">
                        Rejected: {proof.rejected_reason ?? "please re-upload"}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {st === "paid" ? (
                      <span className="text-[12px] text-[color:var(--color-success)]">
                        <Check size={12} className="inline -mt-0.5" /> Confirmed by HQ
                      </span>
                    ) : proof && !proof.rejected_at ? (
                      <button
                        disabled={busyRowId === r.id}
                        onClick={() => removeProof(r.id)}
                        className="text-[12px] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
                      >
                        {busyRowId === r.id ? "Removing…" : "Remove & re-upload"}
                      </button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setActiveRowId(r.id)}>
                        <Upload size={12} /> {proof?.rejected_at ? "Re-upload" : "Upload proof"}
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
          busy={busyRowId === active.id}
          onClose={() => (busyRowId ? null : setActiveRowId(null))}
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
  statement, suggestedRef, busy, onClose, onSubmit,
}: {
  statement: Royalty;
  suggestedRef: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (rowId: string, file: File, reference: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
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
              {file?.name ?? "Tap to attach your bank slip (JPG/PNG/PDF)"}
            </span>
            {file && <span className="text-[11px] text-[color:var(--color-ink-soft)]">Tap again to change.</span>}
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
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
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            onClick={() => file && reference.trim() && onSubmit(statement.id, file, reference.trim())}
            disabled={!file || !reference.trim() || busy}
          >
            <Upload size={14} /> {busy ? "Uploading…" : "Submit proof"}
          </Button>
        </div>
      </div>
    </div>
  );
}
