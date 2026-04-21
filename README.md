# Coco Chick — Franchise Management Portal

A warm, confident franchise operations portal for **Coco Chick Sdn Bhd** (Hainanese chicken rice, 5 outlets in Malaysia). Built with Next.js 15 + Supabase + Tailwind v4 + Recharts + Framer Motion.

> _SSM 202101987654 (9876543-B) · FR-2021-0317 (KPDNHEP)_

## What's inside

**Franchisee portal** (`/portal`) — mobile-first
- `/portal` — dashboard (donut, royalty card, to-dos, quick actions)
- `/portal/sales` — daily sales + 30-day sparkline + confetti when you beat your average
- `/portal/training` — card grid with progress rings, full-screen learning modal, timed quiz
- `/portal/compliance` — audit timeline with colour-coded scores and resolvable items
- `/portal/marketing` — asset library with category filters
- `/portal/support` — ticket submission + live history
- `/portal/announcements` — pinned + unread-accent feed

**Admin war room** (`/admin`)
- `/admin/dashboard` — KPI banner, outlet traffic lights, podium leaderboard, attention list, royalty bar chart
- `/admin/franchisees` — CRUD table, inline edit, contract-expiry highlights, CSV export
- `/admin/royalties` — month picker, editable gross, auto 5% + 2%, mark paid / bulk reminder
- `/admin/audits` — checklist-based audit form, auto risk-flag on 2 consecutive <80 scores
- `/admin/training` — drag-and-drop upload, per-module completion bar chart
- `/admin/announcements` — contenteditable rich text, target by role, schedule, preview, open-rate

## Setup — 10 minutes

### 1. Install
```bash
npm install
```

### 2. Environment
```bash
cp .env.example .env.local
```
Fill in your Supabase URL + anon key. `RESEND_API_KEY` and `WHATSAPP_*` are mocked — any value works.

### 3. Supabase
Create a new project at [supabase.com](https://supabase.com). In the SQL editor, run in order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/seed.sql`

This creates all 12 tables, RLS policies, helper functions, triggers, and populates seed data (4 franchisees, 5 outlets, 5 training modules, 3 months of royalties, 30 days of synthetic sales per outlet, 9 audits, 6 marketing assets, 3 announcements).

### 4. Run
```bash
npm run dev
```

Open http://localhost:3000. The portal works out of the box with mock data — Supabase connection is optional during early exploration.

## Architecture notes

- **Next.js 15** App Router. All pages are client components for now so the demo runs without auth wiring. Swap in server components + `lib/supabase/server.ts` as you productionise.
- **Tailwind v4** via `@tailwindcss/postcss`. Theme tokens live in `app/globals.css` under `@theme`.
- **Framer Motion**: staggered card reveals (`components/ui/Stagger.tsx`), page transitions in the shell, `scale(0.97)` press on buttons.
- **Recharts**: donut, sparkline, royalty bars, training completion.
- **canvas-confetti**: fires on successful sales submit + training pass.
- **Mock data**: `lib/mock-data.ts` gives the UI something to render before Supabase is wired. Drop in real queries using `lib/supabase/client.ts`.
- **Notifications**: `lib/mocks/notifications.ts` logs to the console. Swap the body for Resend + WhatsApp Cloud API calls.

## Business logic map

| Rule | Where it lives |
|------|----------------|
| Royalty = gross × 5%, marketing = gross × 2% | `lib/utils.ts` (`calcRoyalty`) + generated column in SQL |
| Monthly auto-billing on 1st | `public.generate_monthly_royalties()` — schedule via pg_cron or Vercel cron |
| Risk flag on 2 consecutive <80 audits | SQL trigger `trg_audit_risk` + UI recompute in `/admin/audits` |
| Contract expiry reminders (90/60/30) | `notifyContractExpiry()` in `lib/mocks/notifications.ts` — wire to cron |
| Monthly leaderboard email | Send on last day of month using `/admin/dashboard` ranking |

## Styling system

```
Primary       #E8590C    burnt orange
Background    #FFF8F0    warm off-white
Ink           #2D1A0E    deep espresso brown
Success       #3B6D11
Warning       #854F0B
Danger        #A32D2D
Border        #E8590C @ 15% opacity
Radius-card   16px
```

Typography: Plus Jakarta Sans (400 / 500 / 600 / 700) loaded from Google Fonts in `app/layout.tsx`.

## Next steps

- [ ] Wire Supabase auth (`@supabase/ssr` already installed, helpers in `lib/supabase/`)
- [ ] Replace mock-data imports in each page with live queries
- [ ] Schedule `generate_monthly_royalties()` via Supabase cron or Vercel Cron Jobs
- [ ] Swap console-logged notifications for real Resend + WhatsApp Cloud API
- [ ] Add Storybook or Playwright for the learning modal / audit modal

---

Built with care for Chan Kok Weng and the Coco Chick team — `franchise@cocochick.com.my` · +603-4256 7700
