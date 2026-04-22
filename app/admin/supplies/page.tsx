"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SupplyOrder, Outlet, Franchisee } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  Package, Check, Truck, PackageCheck, X as XIcon, Search,
  AlertTriangle, Hourglass, Truck as TruckIcon, CheckCircle2, CornerUpLeft,
} from "lucide-react";

type Status = SupplyOrder["status"];
const FLOW: Status[] = ["submitted", "confirmed", "shipped", "delivered"];

type Column = {
  key: Status;
  title: string;
  emoji: string;
  icon: typeof AlertTriangle;
  color: string;       // hex or css var — column top border + count tint
  ring: string;        // card accent border-top
};

const COLUMNS: Column[] = [
  { key: "submitted", title: "Pending Review", emoji: "⚠️",  icon: AlertTriangle,  color: "#ef4444", ring: "border-t-[#ef4444]" },
  { key: "confirmed", title: "Processing",     emoji: "⏳",  icon: Hourglass,      color: "#f59e0b", ring: "border-t-[#f59e0b]" },
  { key: "shipped",   title: "Out for Delivery", emoji: "🚚", icon: TruckIcon,     color: "#3b82f6", ring: "border-t-[#3b82f6]" },
  { key: "delivered", title: "Delivered",      emoji: "✅",  icon: CheckCircle2,   color: "#10b981", ring: "border-t-[#10b981]" },
  { key: "cancelled", title: "Cancelled",      emoji: "↩️",  icon: CornerUpLeft,   color: "#f97316", ring: "border-t-[#f97316]" },
];

type Row = SupplyOrder & { outlet?: Outlet; franchisee?: Franchisee };

export default function AdminSuppliesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<SupplyOrder[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const load = async () => {
      const [{ data: orderRows, error }, { data: outletData }, { data: franchiseeData }] = await Promise.all([
        supabase
          .from("supply_orders")
          .select("id, outlet_id, submitted_at, status, total, tracking_note, delivered_at")
          .order("submitted_at", { ascending: false }),
        supabase.from("outlets").select("*"),
        supabase.from("franchisees").select("*"),
      ]);
      if (error) { toast("error", `Couldn't load orders: ${error.message}`); return; }
      setOutlets((outletData ?? []) as Outlet[]);
      setFranchisees((franchiseeData ?? []) as Franchisee[]);
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
    };
    load();
    const channel = supabase
      .channel("admin-supplies")
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "supply_order_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [toast]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    return orders
      .map((o) => {
        const outlet = outlets.find((x) => x.id === o.outlet_id);
        const franchisee = outlet ? franchisees.find((f) => f.id === outlet.franchisee_id) : undefined;
        return { ...o, outlet, franchisee };
      })
      .filter((r) =>
        q
          ? (r.outlet?.outlet_code ?? "").toLowerCase().includes(q) ||
            (r.outlet?.location ?? "").toLowerCase().includes(q) ||
            (r.franchisee?.owner_name ?? "").toLowerCase().includes(q) ||
            r.items.some((it) => it.name.toLowerCase().includes(q))
          : true
      );
  }, [orders, outlets, franchisees, query]);

  const byColumn = useMemo(() => {
    const m: Record<Status, Row[]> = { submitted: [], confirmed: [], shipped: [], delivered: [], cancelled: [] };
    for (const r of rows) m[r.status].push(r);
    // newest first inside each column
    for (const k of Object.keys(m) as Status[]) {
      m[k].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
    }
    return m;
  }, [rows]);

  const counts = {
    submitted: byColumn.submitted.length,
    confirmed: byColumn.confirmed.length,
    shipped: byColumn.shipped.length,
    delivered: byColumn.delivered.length,
    cancelled: byColumn.cancelled.length,
  };
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
    toast("success", `Order moved to ${nextStatus}.`);
  };

  const cancel = async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("supply_orders")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast("error", `Cancel failed: ${error.message}`); return; }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
    toast("info", `Order cancelled.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Awaiting action" value={`${counts.submitted}`} sub="Need HQ confirmation" tone={counts.submitted > 0 ? "warning" : "success"} />
        <Kpi label="In fulfilment"   value={`${counts.confirmed + counts.shipped}`} sub="Confirmed + shipped" />
        <Kpi label="Delivered"       value={`${counts.delivered}`} sub="Lifetime" />
        <Kpi label="Open order value" value={`RM ${totalOpenValue.toLocaleString()}`} sub="Submitted → shipped" tone="brand" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              <span className="inline-flex items-center gap-2"><Package size={16} className="text-[color:var(--color-brand)]" /> Orders board</span>
            </CardTitle>
            <CardSubtitle>Drag-style kanban view — each column is a fulfilment stage.</CardSubtitle>
          </div>
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
      </Card>

      {/* Kanban board */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            items={byColumn[col.key]}
            count={byColumn[col.key].length}
            onAdvance={advance}
            onCancel={cancel}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  col, items, count, onAdvance, onCancel,
}: {
  col: Column;
  items: Row[];
  count: number;
  onAdvance: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const Icon = col.icon;
  return (
    <div className="flex flex-col rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]/40">
      {/* Column header */}
      <div
        className="flex items-center justify-between rounded-t-[14px] border-t-[3px] bg-white px-3 py-2.5"
        style={{ borderTopColor: col.color }}
      >
        <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: col.color }}>
          <Icon size={14} /> {col.title}
        </div>
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
          style={{ background: `${col.color}1A`, color: col.color }}
        >
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 p-2.5">
        {items.length === 0 ? (
          <div className="rounded-[12px] border-2 border-dashed border-[color:var(--color-border)] px-3 py-8 text-center text-[12px] text-[color:var(--color-ink-soft)]">
            <Icon size={14} className="mx-auto mb-1 opacity-40" /> No orders
          </div>
        ) : (
          items.map((r) => <OrderCard key={r.id} r={r} onAdvance={onAdvance} onCancel={onCancel} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({
  r, onAdvance, onCancel,
}: {
  r: Row;
  onAdvance: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemCount = r.items.reduce((s, it) => s + it.qty, 0);
  const canAdvance = r.status !== "delivered" && r.status !== "cancelled";

  return (
    <article className={"rounded-[12px] border border-[color:var(--color-border)] bg-white p-3 transition-shadow hover:shadow-sm"}>
      {/* Header: outlet + date */}
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[13px] font-semibold text-[color:var(--color-ink)]">
          {r.outlet?.outlet_code ?? "—"}
        </div>
        <div className="shrink-0 text-[11px] text-[color:var(--color-ink-soft)]">
          {new Date(r.submitted_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
        </div>
      </div>
      <div className="truncate text-[11px] text-[color:var(--color-ink-soft)]">
        {r.franchisee?.owner_name ?? "—"}
      </div>

      {/* Amount + item count on one row */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-[16px] font-bold">RM {r.total.toLocaleString()}</div>
        <div className="text-[11px] text-[color:var(--color-ink-soft)]">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
      </div>

      {r.delivered_at && (
        <div className="mt-1 text-[11px] text-[color:var(--color-success)]">Delivered {formatDate(r.delivered_at)}</div>
      )}

      {/* Actions — compact row */}
      {(canAdvance || r.status === "submitted" || r.items.length > 0) && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-[color:var(--color-border)] pt-2.5">
          {canAdvance && (
            <Button size="sm" onClick={() => onAdvance(r.id)}>
              {r.status === "submitted" && <><Check size={12} /> Confirm</>}
              {r.status === "confirmed" && <><Truck size={12} /> Ship</>}
              {r.status === "shipped" && <><PackageCheck size={12} /> Delivered</>}
            </Button>
          )}
          {r.status === "submitted" && (
            <Button size="sm" variant="outline" onClick={() => onCancel(r.id)}>
              <XIcon size={12} />
            </Button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[11px] font-medium text-[color:var(--color-brand-700)] hover:underline"
          >
            {open ? "Hide" : "Details"}
          </button>
        </div>
      )}

      {open && (
        <div className="mt-2.5 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]/40 p-2.5">
          <div className="space-y-1 text-[11px]">
            {r.items.map((it) => (
              <div key={it.sku} className="flex items-center justify-between gap-2">
                <span className="truncate"><b>{it.qty}×</b> {it.name}</span>
                <span className="shrink-0 text-[color:var(--color-ink-soft)]">RM {(it.qty * it.unit_price).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {r.tracking_note && (
            <div className="mt-2 text-[11px] italic text-[color:var(--color-ink-soft)]">{r.tracking_note}</div>
          )}
          {r.outlet && (
            <Link href={`/admin/outlets/${r.outlet.outlet_code}`} className="mt-2 inline-block text-[11px] font-medium text-[color:var(--color-brand-700)] hover:underline">
              View outlet →
            </Link>
          )}
        </div>
      )}
    </article>
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
