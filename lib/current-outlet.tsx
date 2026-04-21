"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { mockOutlets, mockFranchisees } from "./mock-data";

type Ctx = {
  outletId: string | null;
  ready: boolean;
  setOutletId: (id: string) => void;
  logout: () => void;
};

const OutletContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "cc.auth.outletId";

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved && mockOutlets.some((o) => o.id === saved)) setOutletIdState(saved);
    setReady(true);
  }, []);

  const setOutletId = (id: string) => {
    setOutletIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    window.localStorage.setItem("cc.auth.loggedInAt", new Date().toISOString());
  };

  const logout = () => {
    setOutletIdState(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("cc.auth.loggedInAt");
  };

  return (
    <OutletContext.Provider value={{ outletId, ready, setOutletId, logout }}>
      {children}
    </OutletContext.Provider>
  );
}

/** Returns the authenticated outlet. Caller must ensure ready && outletId before use. */
export function useCurrentOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useCurrentOutlet must be used inside OutletProvider");
  const outlet = mockOutlets.find((o) => o.id === ctx.outletId) ?? mockOutlets[0];
  const franchisee = mockFranchisees.find((f) => f.id === outlet.franchisee_id)!;
  return { outlet, franchisee, outletId: ctx.outletId, ready: ctx.ready, setOutletId: ctx.setOutletId, logout: ctx.logout };
}

export function useAuthGuard() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useAuthGuard must be used inside OutletProvider");
  return { authenticated: !!ctx.outletId, ready: ctx.ready, logout: ctx.logout };
}
