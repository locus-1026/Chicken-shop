"use client";

import { useState } from "react";
import { ChevronDown, Store, Check } from "lucide-react";
import { mockOutlets, mockFranchisees } from "@/lib/mock-data";
import { useCurrentOutlet } from "@/lib/current-outlet";

export function OutletSwitcher() {
  const { outlet, franchisee, setOutletId } = useCurrentOutlet();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[color:var(--color-brand)]"
      >
        <Store size={14} className="text-[color:var(--color-brand)]" />
        <span className="hidden sm:inline">{outlet.outlet_code}</span>
        <span className="hidden md:inline text-[color:var(--color-ink-soft)]">· {franchisee.owner_name.split(" ")[0]}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white shadow-xl">
            <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-brand-50)] px-4 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">Switch franchisee / outlet</div>
              <div className="text-[11px] text-[color:var(--color-ink-soft)]">Demo view — preview each franchisee's portal.</div>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {mockOutlets.map((o) => {
                const f = mockFranchisees.find((x) => x.id === o.franchisee_id)!;
                const active = o.id === outlet.id;
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => {
                        setOutletId(o.id);
                        setOpen(false);
                      }}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors " +
                        (active ? "bg-[color:var(--color-brand-50)]" : "hover:bg-[color:var(--color-brand-50)]/60")
                      }
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-sm font-bold text-white">
                        {o.outlet_code.slice(-1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{o.outlet_code}</span>
                          {f.risk_flag && <span className="rounded-full bg-[color:var(--color-danger-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-danger)]">AT RISK</span>}
                        </div>
                        <div className="truncate text-[12px] text-[color:var(--color-ink-soft)]">{f.owner_name} · {o.state}</div>
                      </div>
                      {active && <Check size={16} className="text-[color:var(--color-brand)]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
