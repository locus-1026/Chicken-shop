-- Coco Chick — step 3 schema.
-- Adds ticket_messages (missing before, so support chat was localStorage-only)
-- and extends the realtime publication to cover every table the UI subscribes to.

----------------------------------------------------------------------
-- 1. ticket_messages
----------------------------------------------------------------------
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author text not null check (author in ('franchisee', 'hq')),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages(ticket_id);

alter table public.ticket_messages enable row level security;

drop policy if exists "franchisee read own ticket messages"  on public.ticket_messages;
drop policy if exists "franchisee write own ticket messages" on public.ticket_messages;
drop policy if exists "admin all ticket messages"            on public.ticket_messages;

-- Franchisees can read/write messages on tickets they submitted OR tickets
-- belonging to their outlets (broader so regional managers work too).
create policy "franchisee read own ticket messages" on public.ticket_messages for select using (
  ticket_id in (
    select t.id from public.support_tickets t
    left join public.outlets o on o.id = t.outlet_id
    where t.submitted_by = auth.uid() or o.franchisee_id = public.my_franchisee_id()
  )
);
create policy "franchisee write own ticket messages" on public.ticket_messages for insert with check (
  ticket_id in (
    select t.id from public.support_tickets t
    left join public.outlets o on o.id = t.outlet_id
    where t.submitted_by = auth.uid() or o.franchisee_id = public.my_franchisee_id()
  )
);
create policy "admin all ticket messages" on public.ticket_messages for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.ticket_messages to anon, authenticated, service_role;

----------------------------------------------------------------------
-- 2. Realtime publication — add the new tables so the UI subscriptions fire.
-- (royalties etc. were already added in a separate SQL snippet.)
----------------------------------------------------------------------
alter publication supabase_realtime add table public.ticket_messages;
alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.compliance_audits;
alter publication supabase_realtime add table public.training_progress;
alter publication supabase_realtime add table public.training_modules;
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.announcement_reads;
