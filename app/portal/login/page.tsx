"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { outletLogins, PREFERRED_CODE_KEY, type OutletLogin } from "@/lib/outlet-logins";
import { ArrowLeft, KeyRound, Lock, Store } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, profile, ready, signIn } = useAuth();

  const [picked, setPicked] = useState<OutletLogin | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (ready && session && profile?.role === "franchisee") router.replace("/portal");
  }, [ready, session, profile, router]);

  const submit = async () => {
    if (!picked) return;
    if (pin !== picked.pin) {
      setShake((s) => s + 1);
      toast("error", "Wrong PIN. Try again.");
      setPin("");
      return;
    }
    setBusy(true);
    // Remember which outlet the user picked (Priya has 2 under one account).
    window.localStorage.setItem(PREFERRED_CODE_KEY, picked.outletCode);
    const { error } = await signIn(picked.email, picked.password);
    setBusy(false);
    if (error) {
      setShake((s) => s + 1);
      toast("error", error);
      return;
    }
    toast("success", `Welcome back, ${picked.owner.split(" ")[0]}.`);
    router.replace("/portal");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)]">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[color:var(--color-brand-100)] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[color:var(--color-brand-200)] blur-3xl opacity-50" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 lg:py-14">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-brand)] text-white text-xl font-bold">C</div>
          <div>
            <h1 className="text-2xl font-semibold">Sign in to your outlet</h1>
            <p className="text-[13px] text-[color:var(--color-ink-soft)]">Pick your outlet, enter your PIN.</p>
          </div>
          <Link href="/admin/login" className="ml-auto text-[12px] text-[color:var(--color-brand-700)] hover:underline">
            HQ admin →
          </Link>
        </div>

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Outlet picker */}
          <section>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              Choose your outlet
            </div>
            <ul className="space-y-2">
              {outletLogins.map((o, i) => {
                const active = picked?.outletCode === o.outletCode;
                return (
                  <motion.li
                    key={o.outletCode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <button
                      onClick={() => { setPicked(o); setPin(""); }}
                      className={
                        "flex w-full items-center gap-4 rounded-[16px] border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
                        (active
                          ? "border-[color:var(--color-brand)] ring-2 ring-[color:var(--color-brand-200)]"
                          : "border-[color:var(--color-border)]")
                      }
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] text-lg font-bold">
                        {o.outletCode.slice(-1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{o.outletCode}</div>
                        <div className="truncate text-[13px] text-[color:var(--color-ink-soft)]">{o.location}</div>
                        <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">Owner: <b className="text-[color:var(--color-ink)] font-medium">{o.owner}</b></div>
                      </div>
                      <Store size={18} className={active ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-ink-soft)]"} />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>

          {/* PIN pad */}
          <section>
            <motion.div
              key={shake}
              animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="sticky top-6 rounded-[20px] border border-[color:var(--color-border)] bg-white p-6 shadow-[0_12px_28px_-14px_rgba(45,26,14,0.15)]"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                <Lock size={14} /> Outlet PIN
              </div>

              {picked ? (
                <>
                  <div className="mt-2">
                    <div className="text-[18px] font-semibold">{picked.outletCode}</div>
                    <div className="text-[13px] text-[color:var(--color-ink-soft)]">{picked.owner} · {picked.location}</div>
                  </div>

                  <input
                    autoFocus
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder="••••"
                    className="mt-4 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-4 text-center text-[28px] font-bold tracking-[0.6em] focus:border-[color:var(--color-brand)] focus:outline-none"
                  />

                  <Button onClick={submit} disabled={pin.length < 4 || busy} className="mt-4 w-full" size="lg">
                    <KeyRound size={16} /> {busy ? "Signing in…" : "Sign in"}
                  </Button>

                  <div className="mt-4 rounded-xl bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[12px] text-[color:var(--color-brand-700)]">
                    <b>Demo PIN:</b> {picked.pin} &nbsp;—&nbsp; (each outlet has its own 4-digit code)
                  </div>
                </>
              ) : (
                <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-background)] py-10 text-center">
                  <Store size={36} className="text-[color:var(--color-brand)]" />
                  <p className="mt-3 text-sm font-medium">Pick an outlet on the left to continue.</p>
                  <p className="mt-1 text-[12px] text-[color:var(--color-ink-soft)]">Each outlet has its own PIN.</p>
                </div>
              )}
            </motion.div>
          </section>
        </div>
      </div>
    </main>
  );
}
