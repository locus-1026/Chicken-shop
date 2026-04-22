-- Coco Chick — step 2 schema.
-- Adds:
--   • royalty_proofs      — franchisee-uploaded bank slips + HQ verification status
--   • supply_orders       — franchisee → HQ product orders
--   • supply_order_items  — line items for each order
--   • sales_reports.channel_mix jsonb + beverage_pct int2  — deeper reporting
--   • Storage bucket `royalty-proofs`  — actual file hosting for slips
--   • RLS policies for the new tables so franchisees see only their outlets
-- Safe to re-run: every DDL uses `if not exists` / `create or replace`.

----------------------------------------------------------------------
-- 1. Extend sales_reports with channel + category split
----------------------------------------------------------------------
alter table public.sales_reports
  add column if not exists channel_mix jsonb,            -- { dine_in, takeaway, delivery }
  add column if not exists beverage_pct int2;            -- 0..100 (food = 100 - beverage)

----------------------------------------------------------------------
-- 2. Royalty proofs
----------------------------------------------------------------------
create table if not exists public.royalty_proofs (
  id uuid primary key default gen_random_uuid(),
  royalty_id uuid not null references public.royalties(id) on delete cascade,
  file_name text not null,
  file_url text,            -- Supabase Storage public-signed URL or path
  bank_reference text not null,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,  -- set when HQ confirms the slip
  verified_by uuid references public.profiles(id),
  rejected_at timestamptz,  -- set when HQ rejects; franchisee re-uploads
  rejected_reason text,
  unique (royalty_id)       -- one active proof per statement at a time
);

create index if not exists royalty_proofs_royalty_id_idx on public.royalty_proofs(royalty_id);

alter table public.royalty_proofs enable row level security;

-- franchisees can read + insert their own outlets' proofs
drop policy if exists "franchisee read own proofs"   on public.royalty_proofs;
drop policy if exists "franchisee upload own proofs" on public.royalty_proofs;
drop policy if exists "franchisee delete own proofs" on public.royalty_proofs;
drop policy if exists "admin all proofs"             on public.royalty_proofs;

create policy "franchisee read own proofs" on public.royalty_proofs for select using (
  royalty_id in (
    select r.id from public.royalties r
    join public.outlets o on o.id = r.outlet_id
    where o.franchisee_id = public.my_franchisee_id()
  )
);
create policy "franchisee upload own proofs" on public.royalty_proofs for insert with check (
  royalty_id in (
    select r.id from public.royalties r
    join public.outlets o on o.id = r.outlet_id
    where o.franchisee_id = public.my_franchisee_id()
  )
);
create policy "franchisee delete own proofs" on public.royalty_proofs for delete using (
  royalty_id in (
    select r.id from public.royalties r
    join public.outlets o on o.id = r.outlet_id
    where o.franchisee_id = public.my_franchisee_id()
  )
);
create policy "admin all proofs" on public.royalty_proofs for all
  using (public.is_admin()) with check (public.is_admin());

----------------------------------------------------------------------
-- 3. Supply orders
----------------------------------------------------------------------
-- Postgres doesn't support `create type if not exists`; use a DO block.
do $do_enum$
begin
  if not exists (select 1 from pg_type where typname = 'supply_order_status') then
    create type supply_order_status as enum ('submitted', 'confirmed', 'shipped', 'delivered', 'cancelled');
  end if;
end;
$do_enum$;

create table if not exists public.supply_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  status supply_order_status not null default 'submitted',
  total numeric(12,2) not null default 0,
  tracking_note text,
  delivered_at timestamptz
);

create index if not exists supply_orders_outlet_id_idx on public.supply_orders(outlet_id);

create table if not exists public.supply_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supply_orders(id) on delete cascade,
  sku text not null,
  name text not null,
  unit text not null,
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null
);

create index if not exists supply_order_items_order_id_idx on public.supply_order_items(order_id);

alter table public.supply_orders      enable row level security;
alter table public.supply_order_items enable row level security;

drop policy if exists "franchisee rw own orders"      on public.supply_orders;
drop policy if exists "admin all orders"              on public.supply_orders;
drop policy if exists "franchisee rw own order items" on public.supply_order_items;
drop policy if exists "admin all order items"         on public.supply_order_items;

create policy "franchisee rw own orders" on public.supply_orders for all
  using (outlet_id in (select id from public.outlets where franchisee_id = public.my_franchisee_id()))
  with check (outlet_id in (select id from public.outlets where franchisee_id = public.my_franchisee_id()));
create policy "admin all orders" on public.supply_orders for all
  using (public.is_admin()) with check (public.is_admin());

create policy "franchisee rw own order items" on public.supply_order_items for all
  using (order_id in (
    select o.id from public.supply_orders o
    join public.outlets ol on ol.id = o.outlet_id
    where ol.franchisee_id = public.my_franchisee_id()
  ))
  with check (order_id in (
    select o.id from public.supply_orders o
    join public.outlets ol on ol.id = o.outlet_id
    where ol.franchisee_id = public.my_franchisee_id()
  ));
create policy "admin all order items" on public.supply_order_items for all
  using (public.is_admin()) with check (public.is_admin());

----------------------------------------------------------------------
-- 4. Storage bucket for payment slips
----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('royalty-proofs', 'royalty-proofs', false)
on conflict (id) do nothing;

-- Franchisees upload/read/delete files under a folder named after their
-- franchisee_id (e.g. "11111111-.../2026-03-CC-001.jpg"). Admins read/write everything.
drop policy if exists "proofs franchisee read"   on storage.objects;
drop policy if exists "proofs franchisee write"  on storage.objects;
drop policy if exists "proofs franchisee delete" on storage.objects;
drop policy if exists "proofs admin all"         on storage.objects;

create policy "proofs franchisee read" on storage.objects for select using (
  bucket_id = 'royalty-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = public.my_franchisee_id()::text
  )
);

create policy "proofs franchisee write" on storage.objects for insert with check (
  bucket_id = 'royalty-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = public.my_franchisee_id()::text
  )
);

create policy "proofs franchisee delete" on storage.objects for delete using (
  bucket_id = 'royalty-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = public.my_franchisee_id()::text
  )
);

----------------------------------------------------------------------
-- 5. Grants (RLS still enforces rows; these just allow table access)
----------------------------------------------------------------------
grant select, insert, update, delete on public.royalty_proofs     to anon, authenticated, service_role;
grant select, insert, update, delete on public.supply_orders      to anon, authenticated, service_role;
grant select, insert, update, delete on public.supply_order_items to anon, authenticated, service_role;

----------------------------------------------------------------------
-- 6. Seed a few supply orders so HQ lands on non-empty data
----------------------------------------------------------------------
do $do_seed$
declare
  o1 uuid := '22222222-2222-2222-2222-222222222201';
  o2 uuid := '22222222-2222-2222-2222-222222222202';
  o3 uuid := '22222222-2222-2222-2222-222222222203';
  new_id uuid;
begin
  -- CC-001 delivered order (3 weeks ago)
  insert into public.supply_orders (outlet_id, submitted_at, status, total, tracking_note, delivered_at)
  values (o1, now() - interval '21 days', 'delivered', 8*28 + 4*95 + 3*42, 'Delivered by KTM Logistics.', now() - interval '18 days')
  returning id into new_id;
  insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price) values
    (new_id, 'chilli',      'Signature chilli paste', '1kg tub',  8, 28),
    (new_id, 'rice',        'Premium jasmine rice',   '10kg bag', 4, 95),
    (new_id, 'box-regular', 'Takeaway box (regular)', '100 pcs',  3, 42);

  -- CC-001 shipped order (7 days ago)
  insert into public.supply_orders (outlet_id, submitted_at, status, total, tracking_note)
  values (o1, now() - interval '7 days', 'shipped', 6*22 + 4*18, 'In transit — ETA tomorrow afternoon.')
  returning id into new_id;
  insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price) values
    (new_id, 'ginger', 'Ginger-scallion oil', '500ml', 6, 22),
    (new_id, 'soy',    'Dark soy reduction',  '1L',    4, 18);

  -- CC-002 delivered
  insert into public.supply_orders (outlet_id, submitted_at, status, total, delivered_at)
  values (o2, now() - interval '5 days', 'delivered', 5*28, now() - interval '3 days')
  returning id into new_id;
  insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price) values
    (new_id, 'chilli', 'Signature chilli paste', '1kg tub', 5, 28);

  -- CC-003 newly submitted (needs HQ action)
  insert into public.supply_orders (outlet_id, submitted_at, status, total)
  values (o3, now() - interval '3 days', 'submitted', 3*95 + 2*14)
  returning id into new_id;
  insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price) values
    (new_id, 'rice',   'Premium jasmine rice', '10kg bag', 3, 95),
    (new_id, 'pandan', 'Pandan essence',       '250ml',    2, 14);
end;
$do_seed$;
