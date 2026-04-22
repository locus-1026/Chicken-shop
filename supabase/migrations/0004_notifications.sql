-- Coco Chick — step 4.
-- Adds a direct notifications table so HQ actions (nudge, coaching call,
-- warning notice, etc.) push a real message to the franchisee in realtime.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,          -- 'nudge_sales' | 'nudge_royalty' | 'coaching_call' | 'warning_notice' | 'nudge_training'
  title text not null,
  body text not null,
  link text,                   -- e.g. "/portal/sales"
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "recipient reads own"       on public.notifications;
drop policy if exists "recipient marks own read"  on public.notifications;
drop policy if exists "admin inserts any"         on public.notifications;
drop policy if exists "admin all notifications"   on public.notifications;

create policy "recipient reads own" on public.notifications for select
  using (recipient_id = auth.uid());

create policy "recipient marks own read" on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "admin inserts any" on public.notifications for insert
  with check (public.is_admin());

create policy "admin all notifications" on public.notifications for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.notifications to anon, authenticated, service_role;

alter publication supabase_realtime add table public.notifications;
