-- Coco Chick — step 2 schema (flat SQL, no DO blocks — for Supabase web editor).
-- Adds:
--   * royalty_proofs       — franchisee-uploaded bank slips + HQ verification status
--   * supply_orders        — franchisee -> HQ product orders
--   * supply_order_items   — line items for each order
--   * sales_reports.channel_mix jsonb + beverage_pct int2
--   * Storage bucket `royalty-proofs`
--   * RLS policies for the new tables
-- First-run only. To re-run, drop the type + tables first.

----------------------------------------------------------------------
-- 1. Extend sales_reports
----------------------------------------------------------------------
alter table public.sales_reports
  add column if not exists channel_mix jsonb,
  add column if not exists beverage_pct int2;

----------------------------------------------------------------------
-- 2. Royalty proofs
----------------------------------------------------------------------
create table if not exists public.royalty_proofs (
  id uuid primary key default gen_random_uuid(),
  royalty_id uuid not null references public.royalties(id) on delete cascade,
  file_name text not null,
  file_url text,
  bank_reference text not null,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  rejected_at timestamptz,
  rejected_reason text,
  unique (royalty_id)
);

create index if not exists royalty_proofs_royalty_id_idx on public.royalty_proofs(royalty_id);

alter table public.royalty_proofs enable row level security;

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
-- 3. Supply orders — enum + tables
----------------------------------------------------------------------
drop type if exists public.supply_order_status cascade;
create type public.supply_order_status as enum ('submitted', 'confirmed', 'shipped', 'delivered', 'cancelled');

create table if not exists public.supply_orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  status public.supply_order_status not null default 'submitted',
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

drop policy if exists "proofs franchisee read"   on storage.objects;
drop policy if exists "proofs franchisee write"  on storage.objects;
drop policy if exists "proofs franchisee delete" on storage.objects;

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
-- 5. Grants
----------------------------------------------------------------------
grant select, insert, update, delete on public.royalty_proofs     to anon, authenticated, service_role;
grant select, insert, update, delete on public.supply_orders      to anon, authenticated, service_role;
grant select, insert, update, delete on public.supply_order_items to anon, authenticated, service_role;

----------------------------------------------------------------------
-- 6. Seed supply orders (flat SQL using CTEs)
----------------------------------------------------------------------
with new_order as (
  insert into public.supply_orders (outlet_id, submitted_at, status, total, tracking_note, delivered_at)
  values ('22222222-2222-2222-2222-222222222201', now() - interval '21 days', 'delivered', 8*28 + 4*95 + 3*42, 'Delivered by KTM Logistics.', now() - interval '18 days')
  returning id
)
insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price)
select new_order.id, x.sku, x.name, x.unit, x.qty, x.unit_price
from new_order, (values
  ('chilli',      'Signature chilli paste', '1kg tub',  8, 28::numeric),
  ('rice',        'Premium jasmine rice',   '10kg bag', 4, 95::numeric),
  ('box-regular', 'Takeaway box (regular)', '100 pcs',  3, 42::numeric)
) as x(sku, name, unit, qty, unit_price);

with new_order as (
  insert into public.supply_orders (outlet_id, submitted_at, status, total, tracking_note)
  values ('22222222-2222-2222-2222-222222222201', now() - interval '7 days', 'shipped', 6*22 + 4*18, 'In transit — ETA tomorrow afternoon.')
  returning id
)
insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price)
select new_order.id, x.sku, x.name, x.unit, x.qty, x.unit_price
from new_order, (values
  ('ginger', 'Ginger-scallion oil', '500ml', 6, 22::numeric),
  ('soy',    'Dark soy reduction',  '1L',    4, 18::numeric)
) as x(sku, name, unit, qty, unit_price);

with new_order as (
  insert into public.supply_orders (outlet_id, submitted_at, status, total, delivered_at)
  values ('22222222-2222-2222-2222-222222222202', now() - interval '5 days', 'delivered', 5*28, now() - interval '3 days')
  returning id
)
insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price)
select new_order.id, x.sku, x.name, x.unit, x.qty, x.unit_price
from new_order, (values
  ('chilli', 'Signature chilli paste', '1kg tub', 5, 28::numeric)
) as x(sku, name, unit, qty, unit_price);

with new_order as (
  insert into public.supply_orders (outlet_id, submitted_at, status, total)
  values ('22222222-2222-2222-2222-222222222203', now() - interval '3 days', 'submitted', 3*95 + 2*14)
  returning id
)
insert into public.supply_order_items (order_id, sku, name, unit, qty, unit_price)
select new_order.id, x.sku, x.name, x.unit, x.qty, x.unit_price
from new_order, (values
  ('rice',   'Premium jasmine rice', '10kg bag', 3, 95::numeric),
  ('pandan', 'Pandan essence',       '250ml',    2, 14::numeric)
) as x(sku, name, unit, qty, unit_price);
