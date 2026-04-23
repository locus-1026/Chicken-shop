"use client";

import { createContext, useContext, useEffect, useState } from "react";

type AdminCtx = {
  email: string | null;
  ready: boolean;
  login: (email: string) => void;
  logout: () => void;
};

const Ctx = createContext<AdminCtx | null>(null);
const KEY = "cc.admin.email";

// Mock admin credentials. In production, Supabase Auth with role='admin'.
export const adminAccounts: Record<string, string> = {
  "admin@jifanwang.com.my":         "coco123",
  "franchise@jifanwang.com.my":     "coco123",
  "chan.kokweng@jifanwang.com.my":  "ceo2021",
};

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (saved && adminAccounts[saved]) setEmail(saved);
    setReady(true);
  }, []);

  const login = (e: string) => {
    setEmail(e);
    window.localStorage.setItem(KEY, e);
  };
  const logout = () => {
    setEmail(null);
    window.localStorage.removeItem(KEY);
  };

  return <Ctx.Provider value={{ email, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth needs AdminAuthProvider");
  return c;
}
