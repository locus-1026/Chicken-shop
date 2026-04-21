"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAdminAuth, adminAccounts } from "@/lib/admin-auth";
import { ArrowLeft, Lock, Mail, ShieldCheck, Eye, EyeOff, ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { email: sessionEmail, ready, login } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(0);
  const lockUntil = useRef<number>(0);

  useEffect(() => {
    if (ready && sessionEmail) router.replace("/admin/dashboard");
  }, [ready, sessionEmail, router]);

  const submit = () => {
    if (Date.now() < lockUntil.current) {
      const secs = Math.ceil((lockUntil.current - Date.now()) / 1000);
      toast("error", `Too many attempts. Try again in ${secs}s.`);
      return;
    }
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      toast("error", "Email and password required.");
      return;
    }
    const expected = adminAccounts[e];
    if (!expected || expected !== password) {
      setShake((s) => s + 1);
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 5) {
        lockUntil.current = Date.now() + 30_000;
        toast("error", "Too many failed attempts. Locked for 30s.");
      } else {
        toast("error", `Wrong credentials. ${5 - next} attempt(s) left.`);
      }
      return;
    }
    setAttempts(0);
    login(e);
    toast("success", "Welcome to HQ.");
    setTimeout(() => router.replace("/admin/dashboard"), 400);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--color-ink)] text-white">
      {/* Ambient accents */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-[color:var(--color-brand)] blur-3xl opacity-25" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[color:var(--color-brand-700)] blur-3xl opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft size={16} /> Back
        </Link>

        <motion.div
          key={shake}
          animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="mt-14 rounded-[20px] border border-white/10 bg-white/5 p-7 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-brand)] text-xl font-bold">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">HQ War Room</div>
              <h1 className="text-xl font-semibold">Admin sign in</h1>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-100">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>
              <b>Authorized HQ personnel only.</b> Activity on this page is logged. Franchisees must use the outlet portal instead.
            </span>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3">
                <Mail size={16} className="text-white/50" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="admin@cocochick.com.my"
                  className="w-full bg-transparent py-3 text-sm placeholder:text-white/40 focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3">
                <Lock size={16} className="text-white/50" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-transparent py-3 text-sm placeholder:text-white/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="p-1 text-white/50 hover:text-white/80"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <Button onClick={submit} size="lg" className="w-full">Sign in to HQ</Button>

            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="w-full text-center text-[11px] text-white/40 hover:text-white/70"
            >
              {showDemo ? "Hide demo credentials" : "Show demo credentials (HQ only)"}
            </button>
            {showDemo && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/75">
                <b>Demo credentials</b><br />
                admin@cocochick.com.my · <span className="font-mono">coco123</span>
              </div>
            )}

            <p className="text-center text-[11px] text-white/50">
              Franchisee? Sign in via <Link href="/portal/login" className="underline hover:text-white">the outlet portal</Link>.
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
