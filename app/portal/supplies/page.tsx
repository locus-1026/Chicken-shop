"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { mockSupplyOrders, resolveMockOutletId } from "@/lib/mock-data";
import type { SupplyOrder } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Plus, Minus, ShoppingBasket, Package, ChevronDown, ChevronRight } from "lucide-react";

const catalog = [
  { id: "chilli",     name: "Signature chilli paste",  unit: "1kg tub",  price: 28,  min: 5, category: "Sauces" },
  { id: "ginger",     name: "Ginger-scallion oil",     unit: "500ml",    price: 22,  min: 3, category: "Sauces" },
  { id: "soy",        name: "Dark soy reduction",      unit: "1L",       price: 18,  min: 2, category: "Sauces" },
  { id: "rice",       name: "Premium jasmine rice",    unit: "10kg bag", price: 95,  min: 2, category: "Dry goods" },
  { id: "pandan",     name: "Pandan essence",          unit: "250ml",    price: 14,  min: 1, category: "Dry goods" },
  { id: "box-regular",name: "Takeaway box (regular)",  unit: "100 pcs",  price: 42,  min: 2, category: "Packaging" },
  { id: "box-family", name: "Takeaway box (family)",   unit: "50 pcs",   price: 38,  min: 1, category: "Packaging" },
  { id: "uniform",    name: "Staff uniform polo",      unit: "1 pc",     price: 55,  min: 0, category: "Branding" },
];

const ORDERS_KEY = (outletId: string) => `cc.supply-orders.${outletId}`;

export default function SuppliesPage() {
  const toast = useToast();
  const { outlet } = useCurrentOutlet();
  const mockOutletId = resolveMockOutletId(outlet);
  const [tab, setTab] = useState<"order" | "history">("order");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [locallyPlaced, setLocallyPlaced] = useState<SupplyOrder[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load any orders the franchisee placed from this device so they don't vanish
  // on refresh. We store under the mock outlet id so the admin page can find
  // them under the same key. If anything is still saved under the raw Supabase
  // UUID from an earlier session, migrate it over.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const legacy = window.localStorage.getItem(ORDERS_KEY(outlet.id));
    const current = window.localStorage.getItem(ORDERS_KEY(mockOutletId));
    if (legacy && outlet.id !== mockOutletId) {
      try {
        const merged = [
          ...(JSON.parse(legacy) as SupplyOrder[]),
          ...(current ? (JSON.parse(current) as SupplyOrder[]) : []),
        ];
        window.localStorage.setItem(ORDERS_KEY(mockOutletId), JSON.stringify(merged));
        window.localStorage.removeItem(ORDERS_KEY(outlet.id));
        setLocallyPlaced(merged);
        return;
      } catch {
        // fall through
      }
    }
    setLocallyPlaced(current ? (JSON.parse(current) as SupplyOrder[]) : []);
  }, [outlet.id, mockOutletId]);

  const persistPlaced = (next: SupplyOrder[]) => {
    setLocallyPlaced(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORDERS_KEY(mockOutletId), JSON.stringify(next));
    }
  };

  const history = useMemo(() => {
    const baseline = mockSupplyOrders.filter((o) => o.outlet_id === mockOutletId);
    return [...locallyPlaced, ...baseline].sort(
      (a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)
    );
  }, [locallyPlaced, mockOutletId]);

  const adjust = (id: string, d: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + d) }));

  const totalQty = Object.values(qty).reduce((s, n) => s + n, 0);
  const totalCost = catalog.reduce((s, item) => s + (qty[item.id] ?? 0) * item.price, 0);

  const submit = () => {
    if (totalQty === 0) {
      toast("error", "Add at least one item to your order.");
      return;
    }
    const items = catalog
      .filter((c) => (qty[c.id] ?? 0) > 0)
      .map((c) => ({ sku: c.id, name: c.name, unit: c.unit, qty: qty[c.id], unit_price: c.price }));
    const newOrder: SupplyOrder = {
      id: "so-new-" + Date.now(),
      outlet_id: mockOutletId,
      submitted_at: new Date().toISOString(),
      status: "submitted",
      items,
      total: totalCost,
    };
    persistPlaced([newOrder, ...locallyPlaced]);
    toast("success", `Order submitted — ${totalQty} items, RM ${totalCost.toLocaleString()}. HQ confirms in 24h.`);
    setQty({});
    setTab("history");
  };

  const grouped = catalog.reduce<Record<string, typeof catalog>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Supplies</CardTitle>
            <CardSubtitle>Order from HQ or review what you've ordered before.</CardSubtitle>
          </div>
          <div className="inline-flex rounded-full border border-[color:var(--color-border)] bg-white p-1 text-[13px]">
            <TabButton active={tab === "order"}   onClick={() => setTab("order")}>
              <ShoppingBasket size={14} /> New order
            </TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              <Package size={14} /> Past orders
              <span className="ml-1 rounded-full bg-[color:var(--color-brand-50)] px-1.5 text-[11px] font-semibold text-[color:var(--color-brand-700)]">
                {history.length}
              </span>
            </TabButton>
          </div>
        </div>
      </Card>

      {tab === "order" ? (
        <>
          <Card className="!p-4">
            <div className="flex items-center justify-between text-[13px] text-[color:var(--color-ink-soft)]">
              <span>Cut-off 4pm daily. Delivery within 48h to {outlet.location}.</span>
              <div className="flex items-center gap-2">
                <Pill tone="brand">{totalQty} items</Pill>
                <Pill tone="success">RM {totalCost.toLocaleString()}</Pill>
              </div>
            </div>
          </Card>

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">{cat}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <Card key={item.id} className="!p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-[12px] text-[color:var(--color-ink-soft)]">{item.unit} · RM {item.price}</div>
                        {item.min > 0 && <div className="text-[11px] text-[color:var(--color-warning)] mt-1">Min order {item.min}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjust(item.id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-brand)]"
                          aria-label="decrease"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="w-8 text-center text-sm font-semibold">{qty[item.id] ?? 0}</div>
                        <button
                          onClick={() => adjust(item.id, +1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-600)]"
                          aria-label="increase"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <div className="sticky bottom-20 lg:bottom-4 z-10">
            <Card className="!p-4 !border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] text-[color:var(--color-ink-soft)]">Order total</div>
                  <div className="text-xl font-semibold">RM {totalCost.toLocaleString()}</div>
                </div>
                <Button onClick={submit} size="lg"><ShoppingBasket size={16} /> Submit order</Button>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <OrderHistory
          orders={history}
          expanded={expanded}
          onToggle={(id) => setExpanded(expanded === id ? null : id)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors " +
        (active
          ? "bg-[color:var(--color-brand)] text-white font-semibold"
          : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
      }
    >
      {children}
    </button>
  );
}

function OrderHistory({
  orders, expanded, onToggle,
}: {
  orders: SupplyOrder[];
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <Card>
        <div className="py-10 text-center text-sm text-[color:var(--color-ink-soft)]">
          No orders yet — place your first one from the <b>New order</b> tab.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const isOpen = expanded === o.id;
        const count = o.items.reduce((s, it) => s + it.qty, 0);
        return (
          <Card key={o.id} className="!p-0 overflow-hidden">
            <button
              onClick={() => onToggle(o.id)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[color:var(--color-brand-50)]/40"
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{formatDate(o.submitted_at)}</span>
                  <span className="text-[color:var(--color-ink-soft)]">·</span>
                  <span className="text-[13px] text-[color:var(--color-ink-soft)]">{count} items · RM {o.total.toLocaleString()}</span>
                </div>
                {o.tracking_note && (
                  <div className="mt-0.5 truncate text-[12px] text-[color:var(--color-ink-soft)]">
                    {o.tracking_note}
                  </div>
                )}
              </div>
              <StatusPill status={o.status} />
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
                        <th className="py-2 pr-4 text-right">Price</th>
                        <th className="py-2 pr-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it) => (
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
                        <td className="py-2 pr-4 text-right font-semibold">RM {o.total.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {o.delivered_at && (
                  <div className="mt-3 text-[12px] text-[color:var(--color-ink-soft)]">
                    Delivered on <b>{formatDate(o.delivered_at)}</b>.
                    {o.tracking_note && <> {o.tracking_note}</>}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: SupplyOrder["status"] }) {
  const tone: "brand" | "warning" | "success" | "neutral" | "danger" =
    status === "delivered" ? "success"
    : status === "shipped" ? "brand"
    : status === "confirmed" ? "brand"
    : status === "cancelled" ? "danger"
    : "warning";
  const label =
    status === "delivered" ? "Delivered"
    : status === "shipped" ? "Shipped"
    : status === "confirmed" ? "Confirmed"
    : status === "cancelled" ? "Cancelled"
    : "Submitted";
  return <Pill tone={tone}>{label}</Pill>;
}
