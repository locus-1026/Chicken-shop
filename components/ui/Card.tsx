"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
}

export function Card({ className, interactive, children, ...rest }: CardProps) {
  return (
    <motion.div
      // data-card lets globals.css pick up admin-vs-portal body classes
      // and re-skin cards (admin = flatter dashboard, portal = softer).
      data-card
      whileHover={interactive ? { y: -4, boxShadow: "0 12px 28px -14px rgba(45,26,14,0.25)" } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "rounded-[16px] border border-[color:var(--color-border)] bg-white p-5 shadow-[0_2px_8px_-6px_rgba(45,26,14,0.10)]",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-[15px] font-semibold text-[color:var(--color-ink)] mb-1", className)}>{children}</h3>;
}

export function CardSubtitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[13px] text-[color:var(--color-ink-soft)]", className)}>{children}</p>;
}
