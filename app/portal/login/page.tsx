"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCurrentOutlet } from "@/lib/current-outlet";
import { mockOutlets, mockFranchisees, outletPins } from "@/lib/mock-data";
import { ArrowLeft, KeyRound, Lock, Store } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const toast = useToast();
  const { outletId, ready, setOutletId } = useCurrentOutlet();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);

  // If already logged in, bounce to portal home.
  useEffect(() => {
    if (ready && outletId) router.replace("/portal");
  }, [ready, outletId, router]);

  const picked = pickedId ? mockOutlets.find((o) => o.id === pickedId)! : null;
  const pickedFranchisee = picked ? mockFranchisees.find((f) => f.id === picked.franchisee_id)! : null;

  const submit = () => {
    if (!pickedId || !picked) return;
    if (pin !== outletPins[pickedId]) {
      setShake((s) => s + 1);
      toast("error", "Wrong PIN. Try again.");
      return;
    }
    setOutletId(pickedId);
    toast("success", `Welcome back, ${pickedFranchisee?.owner_name.split(" ")[0]}.`);
    setTimeout(() => router.replace("/portal"), 400);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--color-background)]">
      {/* Ambient brand blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[color:var(--color-brand-100)] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[color:var(--color-brand-200)] blur-3xl opacity-50" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 lg:py-14">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-brand)] text-white text-xl font-bold">C</div>
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--color-ink)]">Sign in to your outlet</h1>
            <p className="text-[13px] text-[color:var(--color-ink-soft)]">Only staff from the selected outlet can access it.</p>
          </div>
        </div>

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Outlet picker */}
          <section>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              Choose your outlet
            </div>
            <ul className="space-y-2">
              {mockOutlets.map((o, i) => {
                const f = mockFranchisees.find((x) => x.id === o.franchisee_id)!;
                const active = pickedId === o.id;
                return (
                  <motion.li
                    key={o.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                  >
                    <button
                      onClick={() => { setPickedId(o.id); setPin(""); }}
                      className={
                        "flex w-full items-center gap-4 rounded-[16px] border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)] " +
                        (active
                          ? "border-[color:var(--color-brand)] ring-2 ring-[color:var(--color-brand-200)]"
                          : "border-[color:var(--color-border)]")
                      }
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] text-lg font-bold">
                        {o.outlet_code.slice(-1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{o.outlet_code}</span>
                          {f.risk_flag && <span className="rounded-full bg-[color:var(--color-danger-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-danger)]">AT RISK</span>}
                        </div>
                        <div className="truncate text-[13px] text-[color:var(--color-ink-soft)]">{o.location}</div>
                        <div className="mt-0.5 text-[12px] text-[color:var(--color-ink-soft)]">Owner: <b className="text-[color:var(--color-ink)] font-medium">{f.owner_name}</b></div>
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
              initial={{ x: 0 }}
              animate={shake > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="sticky top-6 rounded-[20px] border border-[color:var(--color-border)] bg-white p-6 shadow-[0_12px_28px_-14px_rgba(45,26,14,0.15)]"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
                <Lock size={14} /> Outlet PIN
              </div>

              {picked ? (
                <>
                  <div className="mt-2">
                    <div className="text-[18px] font-semibold">{picked.outlet_code}</div>
                    <div className="text-[13px] text-[color:var(--color-ink-soft)]">{pickedFranchisee?.owner_name} · {picked.location}</div>
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

                  <Button onClick={submit} disabled={pin.length < 4} className="mt-4 w-full" size="lg">
                    <KeyRound size={16} /> Sign in
                  </Button>

                  <div className="mt-4 rounded-xl bg-[color:var(--color-brand-50)] px-3 py-2.5 text-[12px] text-[color:var(--color-brand-700)]">
                    <b>Demo PIN:</b> {outletPins[picked.id]} &nbsp;—&nbsp; (each outlet has its own 4-digit code)
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

export default function LoginPage() {
  return <LoginInner />;
}
