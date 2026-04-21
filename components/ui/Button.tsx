"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger" | "success";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const styles: Record<Variant, string> = {
  primary: "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-600)]",
  ghost:   "bg-transparent text-[color:var(--color-ink)] hover:bg-[color:var(--color-brand-50)]",
  outline: "border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:border-[color:var(--color-brand)]",
  danger:  "bg-[color:var(--color-danger)] text-white hover:brightness-95",
  success: "bg-[color:var(--color-success)] text-white hover:brightness-95",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.08 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
        size === "sm" && "px-3 py-1.5 text-[13px]",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-3 text-[15px]",
        styles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
