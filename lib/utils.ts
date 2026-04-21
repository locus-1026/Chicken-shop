import clsx, { type ClassValue } from "clsx";

export const cn = (...args: ClassValue[]) => clsx(args);

export const RM = (n: number) =>
  "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const RM2 = (n: number) =>
  "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });

export const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-MY", { month: "short", year: "numeric" });

export const daysUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 864e5);
};

export const calcRoyalty = (gross: number) => ({
  royalty: +(gross * 0.05).toFixed(2),
  marketing: +(gross * 0.02).toFixed(2),
  total: +(gross * 0.07).toFixed(2),
});

export const scoreColor = (score: number) =>
  score >= 85 ? "success" : score >= 70 ? "warning" : "danger";
