import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[color:var(--color-background)]">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-brand)] text-white text-2xl font-bold">
          C
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[color:var(--color-ink)] sm:text-5xl">
          Coco Chick Franchise Portal
        </h1>
        <p className="mt-3 max-w-xl text-[color:var(--color-ink-soft)]">
          One warm home for sales, royalties, training, compliance, and everything your outlet needs to run a great day.
        </p>

        <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
          <Link
            href="/portal"
            className="group rounded-[16px] border border-[color:var(--color-border)] bg-white p-6 text-left transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_-14px_rgba(45,26,14,0.25)]"
          >
            <div className="mb-2 inline-flex rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold text-[color:var(--color-brand-700)]">
              For franchisees
            </div>
            <h2 className="text-xl font-semibold">Enter outlet portal →</h2>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              Sales reporting, training, marketing assets, support. Built mobile-first.
            </p>
          </Link>

          <Link
            href="/admin/dashboard"
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
          Coco Chick Sdn Bhd · SSM 202101987654 (9876543-B) · FR-2021-0317 (KPDNHEP)
        </p>
      </section>
    </main>
  );
}
