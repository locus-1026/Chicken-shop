-- Coco Chick — step 6.
-- Add scheduled_at to notifications so coaching calls (and future
-- event-like notifications) carry a proper timestamp instead of
-- having to parse it out of the body.

alter table public.notifications
  add column if not exists scheduled_at timestamptz;
