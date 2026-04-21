"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Franchisee, Outlet } from "./types";
import { createSupabaseBrowserClient } from "./supabase/client";

type Ctx = {
  outletId: string | null;
  outlet: Outlet | null;
  franchisee: Franchisee | null;
  outlets: Outlet[];
  ready: boolean;
  setOutletId: (id: string) => void;
};

const OutletContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "cc.currentOutletId";

export function OutletProvider({
  franchiseeId,
  children,
}: {
  franchiseeId: string | null;
  children: React.ReactNode;
}) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [franchisee, setFranchisee] = useState<Franchisee | null>(null);
  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!franchiseeId) { setReady(true); return; }
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const [{ data: fData }, { data: oData }] = await Promise.all([
        supabase.from("franchisees").select("*").eq("id", franchiseeId).maybeSingle(),
        supabase.from("outlets").select("*").eq("franchisee_id", franchiseeId).order("outlet_code"),
      ]);
      setFranchisee(fData as Franchisee | null);
      const outletList = (oData ?? []) as Outlet[];
      setOutlets(outletList);

      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const defaultId = saved && outletList.some((o) => o.id === saved) ? saved : outletList[0]?.id ?? null;
      setOutletIdState(defaultId);
      setReady(true);
    })();
  }, [franchiseeId]);

  const setOutletId = (id: string) => {
    setOutletIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const outlet = outlets.find((o) => o.id === outletId) ?? null;

  return (
    <OutletContext.Provider value={{ outletId, outlet, franchisee, outlets, ready, setOutletId }}>
      {children}
    </OutletContext.Provider>
  );
}

/** Inside the authed portal shell, outlet + franchisee are guaranteed non-null. */
export function useCurrentOutlet() {
  const c = useContext(OutletContext);
  if (!c) throw new Error("useCurrentOutlet must be used inside OutletProvider");
  return {
    ...c,
    outlet: c.outlet as Outlet,
    franchisee: c.franchisee as Franchisee,
  };
}

/** Raw hook — for the shell itself, which may render while loading. */
export function useOutletState() {
  const c = useContext(OutletContext);
  if (!c) throw new Error("useOutletState must be used inside OutletProvider");
  return c;
}
