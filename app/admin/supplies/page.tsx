"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  mockOutlets,
  mockFranchisees,
} from "@/lib/mock-data";
import type { SupplyOrder } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  Package,
  ChevronDown,
  ChevronRight,
  Check,
  Truck,
  PackageCheck,
  X as XIcon,
  Search,
} from "lucide-react";

type Status = SupplyOrder["status"];
const FLOW: Status[] = ["submitted", "confirmed", "shipped", "delivered"];

export default function AdminSuppliesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<SupplyOrder[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data: orderRows, error } = await supabase
        .from("supply_orders")
        .select("id, outlet_id, submitted_at, status, total, tracking_note, delivered_at")
        .order("submitted_at", { ascending: false });
      if (error) { toast("error", `Couldn't load orders: ${error.message}`); return; }
      const ords = (orderRows ?? []) as Omit<SupplyOrder, "items">[];
      if (ords.length === 0) { setOrders([]); return; }
      const { data: itemRows } = await supabase
        .from("supply_order_items")
        .select("order_id, sku, name, unit, qty, unit_price")
        .in("order_id", ords.map((o) => o.id));
      const byOrder: Record<string, SupplyOrder["items"]> = {};
      for (const it of (itemRows ?? []) as (SupplyOrder["items"][number] & { order_id: string })[]) {
        (byOrder[it.order_id] ??= []).push({ sku: it.sku, name: it.name, unit: it.unit, qty: it.qty, unit_price: it.unit_price });
      }
      setOrders(ords.map((o) => ({ ...o, items: byOrder[o.id] ?? [] })));
    })();
  }, [toast]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .map((o) => {
        const outlet = mockOutlets.find((x) => x.id === o.outlet_id);
        const franchisee = outlet ? mockFranchisees.find((f) => f.id === outlet.franchisee_id) : undefined;
        return { ...o, outlet, franchisee };
      })
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) =>
        q
          ? (r.outlet?.outlet_code ?? "").toLowerCase().includes(q) ||
            (r.outlet?.location ?? "").toLowerCase().includes(q) ||
            (r.franchisee?.owner_name ?? "").toLowerCase().includes(q) ||
            r.items.some((it) => it.name.toLowerCase().includes(q))
          : true
      )
      .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const base: Record<"all" | Status, number> = {
      all: orders.length,
      submitted: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0,
    };
    for (const o of orders) base[o.status] += 1;
    return base;
  }, [orders]);

  const totalOpenValue = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  const advance = async (id: string) => {
    const current = orders.find((o) => o.id === id);
    if (!current) return;
    const nextStatus = FLOW[Math.min(FLOW.indexOf(current.status) + 1, FLOW.length - 1)] ?? current.status;
    if (nextStatus === current.status) return;
    const delivered_at = nextStatus === "delivered" ? new Date().toISOString() : current.delivered_at ?? null;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("supply_orders")
      .update({ status: nextStatus, delivered_at })
      .eq("id", id);
    if (error) { toast("error", `Update failed: ${error.message}`); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: nextStatus, delivered_at } : o)));
    toast("success", `Order ${id.slice(-4)} moved to ${nextStatus}.`);
  };

  const cancel = async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("supply_orders")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast("error", `Cancel failed: ${error.message}`); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
    toast("info", `Order ${id.slice(-4)} cancelled.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Awaiting action" value={`${counts.submitted}`}  sub="Need HQ confirmation" tone={counts.submitted > 0 ? "warning" : "success"} />
        <Kpi label="In fulfilment"   value={`${counts.confirmed + counts.shipped}`} sub="Confirmed + shipped" />
        <Kpi label="Delivered"       value={`${counts.delivered}`} sub="Lifetime" />
        <Kpi label="Open order value" value={`RM ${totalOpenValue.toLocaleString()}`} sub="Submitted → shipped" tone="brand" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><Package size={16} className="text-[color:var(--color-brand)]" /> Supply orders</span>
            </CardTitle>
            <CardSubtitle>Confirm, ship, and close out franchisee requests here.</CardSubtitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-ink-soft)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Outlet, owner, item…"
                className="w-64 rounded-full border border-[color:var(--color-border)] bg-white py-1.5 pl-8 pr-3 text-sm focus:border-[color:var(--color-brand)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", "submitted", "confirmed", "shipped", "delivered", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors " +
                (filter === s
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                  : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-brand-200)]")
              }
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className={"rounded-full px-1.5 text-[10px] font-semibold " + (filter === s ? "bg-white/20" : "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]")}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-sm text-[color:var(--color-ink-soft)]">
            No orders match this filter.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOpen = expanded === r.id;
            const itemCount = r.items.reduce((s, it) => s + it.qty, 0);
            const canAdvance = r.status !== "delivered" && r.status !== "cancelled";
            return (
              <Card key={r.id} className="!p-0 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[color:var(--color-brand-50)]/40"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.outlet?.outlet_code ?? "—"}</span>
                      <span className="text-[13px] text-[color:var(--color-ink-soft)]">·</span>
                      <span className="truncate text-[13px]">{r.outlet?.location ?? ""}</span>
                      <span className="text-[12px] text-[color:var(--color-ink-soft)]">
                        · {r.franchisee?.owner_name ?? "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">
                      Placed {formatDate(r.submitted_at)} · {itemCount} items · RM {r.total.toLocaleString()}
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                </button>

                {isOpen && (
                  <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 py-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                            <th className="py-2 pr-4">Item</th>
                            <th className="py-2 pr-4">Unit</th>
                            <th className="py-2 pr-4 text-right">Qty</th>
                            <th className="py-2 pr-4 text-right">Unit price</th>
                            <th className="py-2 pr-4 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((it) => (
                            <tr key={it.sku} className="border-t border-[color:var(--color-border)]">
                              <td className="py-2 pr-4 font-medium">{it.name}</td>
                              <td className="py-2 pr-4 text-[color:var(--color-ink-soft)]">{it.unit}</td>
                              <td className="py-2 pr-4 text-right">{it.qty}</td>
                              <td className="py-2 pr-4 text-right">RM {it.unit_price}</td>
                              <td className="py-2 pr-4 text-right font-semibold">RM {(it.qty * it.unit_price).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[color:var(--color-border)]">
                            <td colSpan={4} className="py-2 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Order total</td>
                            <td className="py-2 pr-4 text-right font-semibold">RM {r.total.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[12px] text-[color:var(--color-ink-soft)]">
                        <FulfilmentTracker status={r.status} />
                        {r.delivered_at && <> · Delivered {formatDate(r.delivered_at)}</>}
                        {r.tracking_note && <div className="mt-1 italic">{r.tracking_note}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.outlet && (
                          <Link href={`/admin/outlets/${r.outlet.outlet_code}`}>
                            <Button size="sm" variant="outline">View outlet →</Button>
                          </Link>
                        )}
                        {canAdvance && (
                          <Button size="sm" onClick={() => advance(r.id)}>
                            {r.status === "submitted" && <><Check size={12} /> Confirm order</>}
                            {r.status === "confirmed" && <><Truck size={12} /> Mark shipped</>}
                            {r.status === "shipped" && <><PackageCheck size={12} /> Mark delivered</>}
                          </Button>
                        )}
                        {r.status === "submitted" && (
                          <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>
                            <XIcon size={12} /> Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "success" | "warning" | "danger" | "brand";
}) {
  const cls =
    tone === "success" ? "text-[color:var(--color-success)]"
    : tone === "warning" ? "text-[color:var(--color-warning)]"
    : tone === "danger" ? "text-[color:var(--color-danger)]"
    : tone === "brand" ? "text-[color:var(--color-brand-700)]"
    : "";
  return (
    <Card>
      <div className="text-[12px] font-medium text-[color:var(--color-ink-soft)]">{label}</div>
      <div className={"mt-2 text-[22px] font-semibold " + cls}>{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">{sub}</div>
    </Card>
  );
}

function StatusPill({ status }: { status: Status }) {
  const tone: "brand" | "warning" | "success" | "neutral" | "danger" =
    status === "delivered" ? "success"
    : status === "shipped" ? "brand"
    : status === "confirmed" ? "brand"
    : status === "cancelled" ? "danger"
    : "warning";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Pill tone={tone}>{label}</Pill>;
}

function FulfilmentTracker({ status }: { status: Status }) {
  if (status === "cancelled") return <span className="text-[color:var(--color-danger)]">Order cancelled.</span>;
  const steps: { key: Status; label: string }[] = [
    { key: "submitted", label: "Submitted" },
    { key: "confirmed", label: "Confirmed" },
    { key: "shipped", label: "Shipped" },
    { key: "delivered", label: "Delivered" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === status);
  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {steps.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1">
          <span
            className={
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " +
              (i <= currentIdx
                ? "bg-[color:var(--color-brand)] text-white"
                : "bg-[color:var(--color-border)] text-[color:var(--color-ink-soft)]")
            }
          >
            {i < currentIdx ? <Check size={10} /> : i + 1}
          </span>
          <span className={i <= currentIdx ? "font-medium text-[color:var(--color-ink)]" : "text-[color:var(--color-ink-soft)]"}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-1 text-[color:var(--color-ink-soft)]">›</span>}
        </span>
      ))}
    </div>
  );
}
