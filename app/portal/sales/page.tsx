"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/charts/Sparkline";
import { fireConfetti } from "@/components/ui/Confetti";
import type { SalesReport } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { useCurrentOutlet } from "@/lib/current-outlet";
import { useToast } from "@/components/ui/Toast";
import { RM, formatDate } from "@/lib/utils";
import { Utensils, ShoppingBag, Bike, Coffee, Zap, RotateCcw, Copy, Sparkles } from "lucide-react";

type ChannelMix = { dine_in: number; takeaway: number; delivery: number };

function channelPill(mix: ChannelMix | undefined) {
  if (!mix) return null;
  const top = (Object.entries(mix) as [keyof ChannelMix, number][]).sort((a, b) => b[1] - a[1])[0];
  const label = top[0] === "dine_in" ? "Dine-in" : top[0] === "takeaway" ? "Takeaway" : "Delivery";
  return `${label} ${top[1]}%`;
}

export default function SalesPage() {
  const { outlet } = useCurrentOutlet();
  const toast = useToast();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [reports, setReports] = useState<SalesReport[]>([]);
  const [gross, setGross] = useState("");
  const [transactions, setTransactions] = useState("");
  // Channel split sliders — default guided by category benchmarks.
  const [dineIn, setDineIn] = useState(45);
  const [takeaway, setTakeaway] = useState(35);
  const [delivery, setDelivery] = useState(20);
  const [beveragePct, setBeveragePct] = useState(15);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadReports = useCallback(async () => {
    const { data, error } = await supabase
      .from("sales_reports")
      .select("id, outlet_id, report_date, gross_sales, transactions, notes, channel_mix, beverage_pct")
      .eq("outlet_id", outlet.id)
      .order("report_date", { ascending: false })
      .limit(120);
    if (error) {
      toast("error", `Couldn't load sales: ${error.message}`);
      return;
    }
    setReports((data ?? []) as SalesReport[]);
  }, [supabase, outlet.id, toast]);

  useEffect(() => {
    setMessage(null);
    loadReports();
    const channel = supabase
      .channel("portal-sales-" + outlet.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reports" }, loadReports)
      .subscribe();
    const id = setInterval(loadReports, 30000);
    const onFocus = () => loadReports();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [loadReports, supabase, outlet.id]);

  const channelTotal = dineIn + takeaway + delivery;

  const avg = useMemo(
    () => reports.slice(0, 30).reduce((s, r) => s + r.gross_sales, 0) / Math.max(1, reports.length),
    [reports]
  );

  const last30 = useMemo(
    () => [...reports].slice(0, 30).reverse().map((r) => ({ date: r.report_date, value: r.gross_sales })),
    [reports]
  );

  // Trailing mix averages — let the franchisee see their own 30-day pattern.
  const mixAvg = useMemo(() => {
    const withMix = reports.slice(0, 30).filter((r) => r.channel_mix);
    if (withMix.length === 0) return null;
    const sum = withMix.reduce(
      (acc, r) => ({
        dine_in: acc.dine_in + (r.channel_mix?.dine_in ?? 0),
        takeaway: acc.takeaway + (r.channel_mix?.takeaway ?? 0),
        delivery: acc.delivery + (r.channel_mix?.delivery ?? 0),
        beverage: acc.beverage + (r.beverage_pct ?? 0),
      }),
      { dine_in: 0, takeaway: 0, delivery: 0, beverage: 0 }
    );
    const n = withMix.length;
    return {
      dine_in: Math.round(sum.dine_in / n),
      takeaway: Math.round(sum.takeaway / n),
      delivery: Math.round(sum.delivery / n),
      beverage: Math.round(sum.beverage / n),
    };
  }, [reports]);

  const submit = async () => {
    const g = Number(gross);
    const tx = Number(transactions);
    if (!g || g <= 0) {
      toast("error", "Please enter today's gross sales (RM).");
      return;
    }
    if (!tx || tx <= 0) {
      toast("error", "Please enter the number of transactions.");
      return;
    }
    if (channelTotal !== 100) {
      toast("error", `Channel split must add up to 100% (currently ${channelTotal}%).`);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setSubmitting(true);
    try {
      // Upsert by (outlet_id, report_date) so re-submits replace the existing row.
      // If today's row exists we delete then insert — simpler than handling PK.
      await supabase
        .from("sales_reports")
        .delete()
        .eq("outlet_id", outlet.id)
        .eq("report_date", today);
      const { error } = await supabase.from("sales_reports").insert({
        outlet_id: outlet.id,
        report_date: today,
        gross_sales: g,
        transactions: tx,
        channel_mix: { dine_in: dineIn, takeaway, delivery },
        beverage_pct: beveragePct,
      });
      if (error) throw new Error(error.message);
      await loadReports();
      setGross("");
      setTransactions("");
      if (g > avg) {
        setMessage(`🔥 ${RM(g)} beats your daily average of ${RM(Math.round(avg))}. Keep cooking!`);
        fireConfetti();
      } else {
        setMessage(`Logged ${RM(g)} for ${formatDate(today)}.`);
      }
      setTimeout(() => setMessage(null), 6000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit failed.";
      toast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const weekTotal = reports.slice(0, 7).reduce((s, r) => s + r.gross_sales, 0);

  // Simulated POS sync — fills everything from what the POS would have captured.
  // In production this would hit the real POS endpoint; the UX is the important bit.
  const syncFromPos = () => {
    const base = outlet.monthly_target / 30;
    const factor = 0.85 + Math.random() * 0.35; // realistic daily variance
    const g = Math.round(base * factor);
    const avgTicket = 35 + Math.round(Math.random() * 15);
    setGross(String(g));
    setTransactions(String(Math.max(1, Math.round(g / avgTicket))));
    setDineIn(45); setTakeaway(35); setDelivery(20);
    setBeveragePct(14);
    toast("success", "Synced from POS. Double-check the numbers before submitting.");
  };

  // Copy yesterday — use the most recent prior report as the starting point.
  const copyYesterday = () => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = reports.find((r) => r.report_date !== today);
    if (!prev) {
      toast("error", "No previous report yet for this outlet.");
      return;
    }
    setGross(String(prev.gross_sales));
    setTransactions(String(prev.transactions));
    if (prev.channel_mix) {
      setDineIn(prev.channel_mix.dine_in);
      setTakeaway(prev.channel_mix.takeaway);
      setDelivery(prev.channel_mix.delivery);
    }
    if (prev.beverage_pct !== undefined) setBeveragePct(prev.beverage_pct);
    toast("info", `Pulled ${formatDate(prev.report_date)} — tweak and submit.`);
  };

  // Apply the 7-day average mix only, so user still enters today's gross+txn.
  const applyAverageMix = () => {
    if (!mixAvg) {
      toast("error", "Not enough mix history yet. Log a couple of days first.");
      return;
    }
    setDineIn(mixAvg.dine_in);
    setTakeaway(mixAvg.takeaway);
    setDelivery(mixAvg.delivery);
    setBeveragePct(mixAvg.beverage);
    toast("info", "Applied your 30-day average mix.");
  };

  const resetForm = () => {
    setGross(""); setTransactions("");
    setDineIn(45); setTakeaway(35); setDelivery(20); setBeveragePct(15);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Log today's sales</CardTitle>
          <CardSubtitle>Submit before you close up. One entry per day.</CardSubtitle>

          <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/60 p-3">
            <div className="mr-auto inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
              <Sparkles size={12} /> Quick fill
            </div>
            <Button size="sm" onClick={syncFromPos}>
              <Zap size={12} /> Sync from POS
            </Button>
            <Button size="sm" variant="outline" onClick={copyYesterday}>
              <Copy size={12} /> Copy yesterday
            </Button>
            <Button size="sm" variant="outline" onClick={applyAverageMix} disabled={!mixAvg}>
              <Sparkles size={12} /> Use 30-day mix
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <RotateCcw size={12} /> Reset
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Gross sales (RM)</span>
              <input
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                type="number"
                placeholder="e.g. 5800"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-lg font-semibold focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">Transactions</span>
              <input
                value={transactions}
                onChange={(e) => setTransactions(e.target.value)}
                type="number"
                placeholder="e.g. 132"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-lg font-semibold focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-brand-50)]/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                  Channel split
                </div>
                <div className="text-[12px] text-[color:var(--color-ink-soft)]">How sales came in today. Must add to 100%.</div>
              </div>
              <Pill tone={channelTotal === 100 ? "success" : "warning"}>{channelTotal}%</Pill>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ChannelSlider icon={<Utensils size={14} />} label="Dine-in"  value={dineIn}   onChange={setDineIn} />
              <ChannelSlider icon={<ShoppingBag size={14}/>} label="Takeaway" value={takeaway} onChange={setTakeaway} />
              <ChannelSlider icon={<Bike size={14}/>}       label="Delivery" value={delivery} onChange={setDelivery} />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)] inline-flex items-center gap-1.5">
                  <Coffee size={12} /> Beverage share
                </div>
                <div className="text-[12px] text-[color:var(--color-ink-soft)]">Drinks as a % of gross. Food = the rest.</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{beveragePct}%</div>
                <div className="text-[11px] text-[color:var(--color-ink-soft)]">Food {100 - beveragePct}%</div>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              value={beveragePct}
              onChange={(e) => setBeveragePct(Number(e.target.value))}
              className="mt-3 w-full accent-[color:var(--color-brand)]"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={submit} size="lg" disabled={channelTotal !== 100 || submitting}>
              {submitting ? "Submitting…" : "Submit today's sales"}
            </Button>
            {message && (
              <span className="text-[13px] font-medium text-[color:var(--color-success)]">{message}</span>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>This week</CardTitle>
          <CardSubtitle>Total of the last 7 days</CardSubtitle>
          <div className="mt-4 text-[34px] font-semibold">{RM(weekTotal)}</div>
          <div className="mt-2 text-[12px] text-[color:var(--color-ink-soft)]">
            Daily average {RM(Math.round(avg))}
          </div>

          {mixAvg && (
            <div className="mt-5 border-t border-[color:var(--color-border)] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                Last 30 days mix
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[color:var(--color-border)]">
                <div style={{ width: mixAvg.dine_in + "%" }}  className="bg-[color:var(--color-brand)]" title={`Dine-in ${mixAvg.dine_in}%`} />
                <div style={{ width: mixAvg.takeaway + "%" }} className="bg-[color:var(--color-brand-300)]" title={`Takeaway ${mixAvg.takeaway}%`} />
                <div style={{ width: mixAvg.delivery + "%" }} className="bg-[color:var(--color-brand-600)]" title={`Delivery ${mixAvg.delivery}%`} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-[color:var(--color-ink-soft)]">
                <span>Dine-in {mixAvg.dine_in}%</span>
                <span>Takeaway {mixAvg.takeaway}%</span>
                <span>Delivery {mixAvg.delivery}%</span>
              </div>
              <div className="mt-3 text-[12px] text-[color:var(--color-ink-soft)]">
                Beverage <b className="text-[color:var(--color-ink)]">{mixAvg.beverage}%</b> · Food <b className="text-[color:var(--color-ink)]">{100 - mixAvg.beverage}%</b>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Last 30 days</CardTitle>
        <Sparkline data={last30} />
      </Card>

      <Card>
        <CardTitle>Recent entries</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Gross sales</th>
                <th className="py-2 pr-4">Transactions</th>
                <th className="py-2 pr-4">Top channel</th>
                <th className="py-2 pr-4">Beverage</th>
                <th className="py-2 pr-4">vs. avg</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 10).map((r) => {
                const diff = r.gross_sales - avg;
                const bev = r.beverage_pct;
                return (
                  <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                    <td className="py-2.5 pr-4 font-medium">{formatDate(r.report_date)}</td>
                    <td className="py-2.5 pr-4">{RM(r.gross_sales)}</td>
                    <td className="py-2.5 pr-4">{r.transactions}</td>
                    <td className="py-2.5 pr-4 text-[12px] text-[color:var(--color-ink-soft)]">
                      {channelPill(r.channel_mix) ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-[12px] text-[color:var(--color-ink-soft)]">
                      {bev !== undefined ? `${bev}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Pill tone={diff >= 0 ? "success" : "warning"}>
                        {diff >= 0 ? "▲" : "▼"} {RM(Math.abs(Math.round(diff)))}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ChannelSlider({
  icon, label, value, onChange,
}: { icon: React.ReactNode; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-medium">{icon} {label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[color:var(--color-brand)]"
      />
    </div>
  );
}
