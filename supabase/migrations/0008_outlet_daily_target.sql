-- Add a daily_target column so HQ can set a per-outlet daily sales
-- target separately from the monthly_target. Defaults to NULL — UI
-- falls back to monthly_target / days_in_month when not set.
--
-- Safe to run multiple times.

alter table public.outlets
  add column if not exists daily_target numeric(14,2);
