"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { mockOutlets, mockFranchisees } from "./mock-data";

type Ctx = {
  outletId: string;
  setOutletId: (id: string) => void;
};

const OutletContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "cc.activeOutletId";

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const [outletId, setOutletIdState] = useState<string>(mockOutlets[0].id);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved && mockOutlets.some((o) => o.id === saved)) setOutletIdState(saved);
  }, []);

  const setOutletId = (id: string) => {
    setOutletIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  return <OutletContext.Provider value={{ outletId, setOutletId }}>{children}</OutletContext.Provider>;
}

export function useCurrentOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useCurrentOutlet must be used inside OutletProvider");
  const outlet = mockOutlets.find((o) => o.id === ctx.outletId) ?? mockOutlets[0];
  const franchisee = mockFranchisees.find((f) => f.id === outlet.franchisee_id)!;
  return { outlet, franchisee, outletId: ctx.outletId, setOutletId: ctx.setOutletId };
}
