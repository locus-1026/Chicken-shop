"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "./supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "franchisee" | "admin" | "regional_manager";
  franchisee_id: string | null;
};

type Ctx = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, franchisee_id")
      .eq("id", s.user.id)
      .maybeSingle();
    if (error) {
      console.error("profile fetch", error);
      setProfile(null);
    } else {
      setProfile(data as Profile | null);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };
  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  };
  const refresh = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadProfile(data.session);
  };

  return (
    <AuthContext.Provider value={{ session, profile, ready, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
