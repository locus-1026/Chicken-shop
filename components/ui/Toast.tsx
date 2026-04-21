"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className={
                "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg bg-white " +
                (t.kind === "success"
                  ? "border-[color:var(--color-success)]"
                  : t.kind === "error"
                  ? "border-[color:var(--color-danger)]"
                  : "border-[color:var(--color-border)]")
              }
            >
              <span
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full " +
                  (t.kind === "success"
                    ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                    : t.kind === "error"
                    ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
                    : "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]")
                }
              >
                {t.kind === "success" ? <Check size={14} /> : t.kind === "error" ? <AlertCircle size={14} /> : <Info size={14} />}
              </span>
              <div className="text-sm text-[color:var(--color-ink)]">{t.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.push;
}
