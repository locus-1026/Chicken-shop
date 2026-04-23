import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[color:var(--color-background)]">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center">
        <img
          src="/brand/logo.png"
          alt="JI FAN WANG"
          className="mb-4 h-20 w-20 object-contain"
        />
        <h1 className="text-4xl font-bold tracking-tight text-[color:var(--color-ink)] sm:text-5xl">
          JI FAN WANG · 鸡饭王
        </h1>
        <div className="mt-1 text-sm font-medium text-[color:var(--color-brand-700)]">
          Franchise Portal
        </div>
        <p className="mt-3 max-w-xl text-[color:var(--color-ink-soft)]">
          One warm home for sales, royalties, training, compliance, and everything your outlet needs to run a great day.
        </p>

        <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
          <Link
            href="/portal/login"
            className="group rounded-[16px] border border-[color:var(--color-border)] bg-white p-6 text-left transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)]"
          >
            <div className="mb-2 inline-flex rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold text-[color:var(--color-brand-700)]">
              For franchisees
            </div>
            <h2 className="text-xl font-semibold">Sign in to your outlet →</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              Each outlet signs in with its own PIN. Sales, training, marketing, support — all mobile-first.
            </p>
          </Link>

          <Link
            href="/admin/login"
            className="group rounded-[16px] border border-[color:var(--color-border)] bg-white p-6 text-left transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)]"
          >
            <div className="mb-2 inline-flex rounded-full bg-[color:#2D1A0E] px-3 py-1 text-xs font-semibold text-white">
              For HQ
            </div>
            <h2 className="text-xl font-semibold">Enter admin war room →</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              Outlet traffic lights, royalty collections, audits, announcements.
            </p>
          </Link>
        </div>

        <p className="mt-10 text-xs text-[color:var(--color-ink-soft)]">
          鸡饭王 Sdn Bhd · SSM 202101987654 (9876543-B) · FR-2021-0317 (KPDNHEP)
        </p>
      </section>
    </main>
  );
}
