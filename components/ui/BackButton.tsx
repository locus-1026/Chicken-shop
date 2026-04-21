"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Unified back button — uses browser history by default so it always returns
// the user to exactly where they came from (e.g. outlet → franchisee → …).
// Pass `fallbackHref` so pages opened via a deep link still have a sensible
// destination when there's no history to pop back to.
export function BackButton({
  label = "Back",
  fallbackHref,
  size = "md",
}: {
  label?: string;
  fallbackHref?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    }
  };

  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-[12px]"
      : "px-4 py-2 text-sm";

  return (
    <button
      type="button"
      onClick={goBack}
      className={
        "inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white font-medium text-[color:var(--color-ink-soft)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand-700)] " +
        sizeCls
      }
    >
      <ArrowLeft size={size === "sm" ? 12 : 14} />
      {label}
    </button>
  );
}
