import { Button } from "./Button";

export function EmptyState({
  title,
  description,
  cta,
  onCta,
  icon,
}: {
  title: string;
  description?: string;
  cta?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="mb-4 h-24 w-24">
        {icon ?? (
          <svg viewBox="0 0 120 120" className="h-full w-full">
            <circle cx="60" cy="60" r="58" fill="#FFE0C2" />
            <path d="M40 72 q20 -24 40 0" stroke="#E8590C" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="48" cy="52" r="4" fill="#2D1A0E" />
            <circle cx="72" cy="52" r="4" fill="#2D1A0E" />
          </svg>
        )}
      </div>
      <h3 className="text-[16px] font-semibold text-[color:var(--color-ink)]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[color:var(--color-ink-soft)]">{description}</p>}
      {cta && <Button onClick={onCta} className="mt-4">{cta}</Button>}
    </div>
  );
}
