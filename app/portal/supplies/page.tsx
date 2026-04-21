"use client";

import { useState } from "react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { Plus, Minus, ShoppingBasket } from "lucide-react";

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

export default function SuppliesPage() {
  const toast = useToast();
  const { outlet } = useCurrentOutlet();
  const [qty, setQty] = useState<Record<string, number>>({});

  const adjust = (id: string, d: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + d) }));

  const totalQty = Object.values(qty).reduce((s, n) => s + n, 0);
  const totalCost = catalog.reduce((s, item) => s + (qty[item.id] ?? 0) * item.price, 0);

  const submit = () => {
    if (totalQty === 0) {
      toast("error", "Add at least one item to your order.");
      return;
    }
    toast("success", `Order submitted for ${outlet.outlet_code} — ${totalQty} items, RM ${totalCost.toLocaleString()}. HQ confirms in 24h.`);
    setQty({});
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
            <CardTitle>Order from HQ</CardTitle>
            <CardSubtitle>Cut-off is 4pm daily. Delivery within 48 hours to {outlet.location}.</CardSubtitle>
          </div>
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
    </div>
  );
}
