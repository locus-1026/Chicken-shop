import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  success: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]",
  warning: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]",
  danger:  "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]",
  neutral: "bg-[color:#F2EBE3] text-[color:var(--color-ink-soft)]",
  brand:   "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
