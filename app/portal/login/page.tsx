"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Lock, Mail, Store, Eye, EyeOff } from "lucide-react";

const demoAccounts = [
  { email: "lim@cocochick.my",    owner: "Lim Chee Keong", outlet: "CC-001 · PJ" },
  { email: "priya@cocochick.my",  owner: "Priya Nair",     outlet: "CC-002 / CC-003" },
  { email: "fadzli@cocochick.my", owner: "Ahmad Fadzli",   outlet: "CC-004 · JB" },
  { email: "kevin@cocochick.my",  owner: "Kevin Ooi",      outlet: "CC-005 · Kuching" },
];

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, profile, ready, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (ready && session && profile?.role === "franchisee") {
      router.replace("/portal");
    }
  }, [ready, session, profile, router]);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast("error", "Email and password required.");
      return;
    }
    setBusy(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (error) {
      setShake((s) => s + 1);
      toast("error", "Wrong email or password.");
      return;
    }
    toast("success", "Welcome back!");
    router.replace("/portal");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)]">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[color:var(--color-brand-100)] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[color:var(--color-brand-200)] blur-3xl opacity-50" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">
          <ArrowLeft size={16} /> Back
        </Link>

        <motion.div
          key={shake}
          animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="mt-10 rounded-[20px] border border-[color:var(--color-border)] bg-white p-7 shadow-[0_12px_28px_-14px_rgba(45,26,14,0.15)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-brand)] text-xl font-bold text-white">C</div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">Outlet portal</div>
              <h1 className="text-xl font-semibold text-[color:var(--color-ink)]">Sign in</h1>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3">
                <Mail size={16} className="text-[color:var(--color-ink-soft)]" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@cocochick.my"
                  className="w-full bg-transparent py-3 text-sm focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3">
                <Lock size={16} className="text-[color:var(--color-ink-soft)]" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-transparent py-3 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <Button onClick={submit} size="lg" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>

            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="w-full text-center text-[12px] text-[color:var(--color-brand-700)] hover:underline"
            >
              {showDemo ? "Hide demo accounts" : "Show demo accounts"}
            </button>

            {showDemo && (
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[12px]">
                <div className="mb-2 font-semibold text-[color:var(--color-brand-700)]">Password for all: <span className="font-mono">coco2024</span></div>
                <ul className="space-y-1">
                  {demoAccounts.map((a) => (
                    <li key={a.email}>
                      <button
                        onClick={() => { setEmail(a.email); setPassword("coco2024"); }}
                        className="w-full text-left rounded-lg px-2 py-1 hover:bg-white"
                      >
                        <span className="font-mono">{a.email}</span>
                        <span className="text-[color:var(--color-ink-soft)]"> — {a.owner} ({a.outlet})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-center text-[11px] text-[color:var(--color-ink-soft)]">
              <Store size={11} className="inline -mt-0.5" /> HQ staff? Sign in via <Link href="/admin/login" className="text-[color:var(--color-brand-700)] underline">admin war room</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
