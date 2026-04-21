-- Coco Chick — Franchise Management Portal schema

create extension if not exists "pgcrypto";

-- Profiles map auth users to roles & linked franchisee
create type user_role as enum ('franchisee', 'regional_manager', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'franchisee',
  franchisee_id uuid,
  assigned_states text[] default '{}',
  created_at timestamptz default now()
);

create type franchisee_status as enum ('active', 'suspended', 'expired', 'pending');

create table public.franchisees (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  ic_number text not null,
  contact text not null,
  email text,
  agreement_start date not null,
  agreement_end date not null,
  status franchisee_status not null default 'active',
  risk_flag boolean not null default false,
  created_at timestamptz default now()
);

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  franchisee_id uuid not null references public.franchisees(id) on delete cascade,
  outlet_code text unique not null,
  location text not null,
  state text not null,
  opening_date date not null,
  monthly_target numeric(12,2) not null default 0,
  monthly_actual numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create type royalty_status as enum ('pending', 'paid', 'overdue');

create table public.royalties (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  billing_period date not null, -- first of month
  gross_sales numeric(12,2) not null default 0,
  royalty_amount numeric(12,2) generated always as (gross_sales * 0.05) stored,
  marketing_fee numeric(12,2) generated always as (gross_sales * 0.02) stored,
  due_date date not null,
  paid_at timestamptz,
  status royalty_status not null default 'pending',
  created_at timestamptz default now(),
  unique (outlet_id, billing_period)
);

create table public.sales_reports (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  report_date date not null,
  gross_sales numeric(12,2) not null,
  transactions int default 0,
  notes text,
  submitted_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (outlet_id, report_date)
);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  video_url text,
  materials_url text,
  category text not null,
  required_for_role user_role not null default 'franchisee',
  passing_score int not null default 80,
  created_at timestamptz default now()
);

create table public.training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  completed_at timestamptz,
  score int,
  attempts int not null default 0,
  unique (user_id, module_id)
);

create table public.compliance_audits (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  audit_date date not null,
  score int not null,
  checklist_items jsonb not null default '[]'::jsonb,
  auditor text not null,
  signed_off_by text,
  risk_flag boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  file_url text not null,
  thumbnail_url text,
  file_type text not null,
  created_at timestamptz default now()
);

create type ticket_status as enum ('open', 'in_progress', 'resolved');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references public.outlets(id) on delete set null,
  submitted_by uuid references public.profiles(id),
  category text not null,
  subject text not null,
  description text not null,
  photo_url text,
  status ticket_status not null default 'open',
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_role user_role,
  target_outlet_id uuid references public.outlets(id) on delete cascade,
  pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.announcement_reads (
  announcement_id uuid references public.announcements(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (announcement_id, user_id)
);

-- helper: current profile
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer
as $$
  select * from public.profiles where id = auth.uid();
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.franchisees enable row level security;
alter table public.outlets enable row level security;
alter table public.royalties enable row level security;
alter table public.sales_reports enable row level security;
alter table public.training_modules enable row level security;
alter table public.training_progress enable row level security;
alter table public.compliance_audits enable row level security;
alter table public.marketing_assets enable row level security;
alter table public.support_tickets enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Admin-all policy helper
create policy "admin all profiles" on public.profiles for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "self read profile" on public.profiles for select using (id = auth.uid());

create policy "admin all franchisees" on public.franchisees for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "franchisee read own" on public.franchisees for select using (
  id = (select franchisee_id from public.profiles where id = auth.uid())
);

create policy "admin all outlets" on public.outlets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "franchisee read own outlets" on public.outlets for select using (
  franchisee_id = (select franchisee_id from public.profiles where id = auth.uid())
);
create policy "regional read outlets" on public.outlets for select using (
  state = any ((select assigned_states from public.profiles where id = auth.uid()))
);

-- Repeat select-own pattern for downstream tables
create policy "admin all royalties" on public.royalties for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "franchisee read own royalties" on public.royalties for select using (
  outlet_id in (select id from public.outlets where franchisee_id =
    (select franchisee_id from public.profiles where id = auth.uid()))
);

create policy "admin all sales" on public.sales_reports for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "franchisee rw own sales" on public.sales_reports for all using (
  outlet_id in (select id from public.outlets where franchisee_id =
    (select franchisee_id from public.profiles where id = auth.uid()))
);

create policy "all read training modules" on public.training_modules for select using (true);
create policy "admin manage training" on public.training_modules for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "self training progress" on public.training_progress for all using (user_id = auth.uid());
create policy "admin all training progress" on public.training_progress for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "admin all audits" on public.compliance_audits for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "franchisee read own audits" on public.compliance_audits for select using (
  outlet_id in (select id from public.outlets where franchisee_id =
    (select franchisee_id from public.profiles where id = auth.uid()))
);

create policy "all read marketing" on public.marketing_assets for select using (true);
create policy "admin manage marketing" on public.marketing_assets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "self tickets" on public.support_tickets for all using (submitted_by = auth.uid());
create policy "admin all tickets" on public.support_tickets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "all read announcements" on public.announcements for select using (true);
create policy "admin manage announcements" on public.announcements for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "self reads" on public.announcement_reads for all using (user_id = auth.uid());

-- Auto billing function
create or replace function public.generate_monthly_royalties()
returns void language plpgsql security definer as $$
declare
  period_start date := date_trunc('month', current_date - interval '1 month')::date;
  due date := (current_date + interval '14 days')::date;
begin
  insert into public.royalties (outlet_id, billing_period, gross_sales, due_date)
  select o.id, period_start, coalesce(sum(s.gross_sales),0), due
  from public.outlets o
  left join public.sales_reports s
    on s.outlet_id = o.id
   and s.report_date >= period_start
   and s.report_date < period_start + interval '1 month'
  group by o.id
  on conflict (outlet_id, billing_period) do nothing;
end;
$$;

-- Risk flag trigger
create or replace function public.check_audit_risk()
returns trigger language plpgsql as $$
declare
  recent_scores int[];
begin
  select array_agg(score order by audit_date desc)
    into recent_scores
  from (select score, audit_date from public.compliance_audits
        where outlet_id = new.outlet_id order by audit_date desc limit 2) t;
  if array_length(recent_scores,1) = 2 and recent_scores[1] < 80 and recent_scores[2] < 80 then
    update public.franchisees set risk_flag = true
    where id = (select franchisee_id from public.outlets where id = new.outlet_id);
  end if;
  return new;
end;
$$;

create trigger trg_audit_risk
after insert on public.compliance_audits
for each row execute function public.check_audit_risk();
