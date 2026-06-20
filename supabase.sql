-- SHELL CAFÉ GESTÃO V4
-- Execute no Supabase SQL Editor

create extension if not exists "pgcrypto";

do $$ begin create type user_role as enum ('super_admin','manager','employee'); exception when duplicate_object then null; end $$;
do $$ begin create type punch_type as enum ('entrada','saida_intervalo','volta_intervalo','saida'); exception when duplicate_object then null; end $$;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reference text,
  latitude numeric,
  longitude numeric,
  radius_meters numeric default 150,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references stores(id),
  email text unique,
  name text not null,
  role user_role not null default 'employee',
  shift text,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists time_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  store_id uuid references stores(id),
  type punch_type not null,
  punched_at timestamptz not null default now(),
  latitude numeric,
  longitude numeric,
  distance_meters numeric,
  outside_area boolean default false,
  selfie_path text,
  note text,
  device_info text,
  created_at timestamptz not null default now()
);

create table if not exists occurrences (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id),
  user_id uuid references profiles(id),
  category text default 'Operacional',
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists operational_checklists (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id),
  user_id uuid references profiles(id),
  type text not null,
  items jsonb not null,
  notes text,
  completed_count integer default 0,
  total_count integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;
alter table profiles enable row level security;
alter table time_punches enable row level security;
alter table occurrences enable row level security;
alter table operational_checklists enable row level security;
alter table audit_logs enable row level security;

create or replace function my_role()
returns text language sql security definer set search_path=public as $$
  select role::text from profiles where id=auth.uid() and active=true
$$;

create or replace function my_store()
returns uuid language sql security definer set search_path=public as $$
  select store_id from profiles where id=auth.uid() and active=true
$$;

create or replace function is_super_admin()
returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from profiles where id=auth.uid() and role='super_admin' and active=true)
$$;

create or replace function is_manager_or_super()
returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from profiles where id=auth.uid() and role in ('super_admin','manager') and active=true)
$$;

drop policy if exists stores_select on stores;
drop policy if exists stores_write_super on stores;
create policy stores_select on stores for select using (is_super_admin() or id=my_store());
create policy stores_write_super on stores for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert_admin on profiles;
drop policy if exists profiles_update_admin on profiles;
create policy profiles_select on profiles for select using (id=auth.uid() or is_super_admin() or (my_role()='manager' and store_id=my_store()));
create policy profiles_insert_admin on profiles for insert with check (is_super_admin() or (my_role()='manager' and store_id=my_store() and role='employee'));
create policy profiles_update_admin on profiles for update using (is_super_admin() or (my_role()='manager' and store_id=my_store())) with check (is_super_admin() or (my_role()='manager' and store_id=my_store()));

drop policy if exists punches_select on time_punches;
drop policy if exists punches_insert on time_punches;
drop policy if exists punches_update_admin on time_punches;
create policy punches_select on time_punches for select using (user_id=auth.uid() or is_super_admin() or (my_role()='manager' and store_id=my_store()));
create policy punches_insert on time_punches for insert with check (user_id=auth.uid());
create policy punches_update_admin on time_punches for update using (is_manager_or_super()) with check (is_manager_or_super());

drop policy if exists occurrences_select on occurrences;
drop policy if exists occurrences_insert on occurrences;
create policy occurrences_select on occurrences for select using (is_super_admin() or store_id=my_store());
create policy occurrences_insert on occurrences for insert with check (user_id=auth.uid());

drop policy if exists checklist_select on operational_checklists;
drop policy if exists checklist_insert on operational_checklists;
create policy checklist_select on operational_checklists for select using (user_id=auth.uid() or is_super_admin() or store_id=my_store());
create policy checklist_insert on operational_checklists for insert with check (user_id=auth.uid());

drop policy if exists audit_select on audit_logs;
drop policy if exists audit_insert on audit_logs;
create policy audit_select on audit_logs for select using (is_super_admin());
create policy audit_insert on audit_logs for insert with check (actor_id=auth.uid());

drop policy if exists selfies_read on storage.objects;
drop policy if exists selfies_insert on storage.objects;
create policy selfies_read on storage.objects for select using (bucket_id='ponto-selfies' and (is_manager_or_super() or owner=auth.uid()));
create policy selfies_insert on storage.objects for insert with check (bucket_id='ponto-selfies' and owner=auth.uid());

insert into stores (name, reference, radius_meters)
values
('Shell Café Samambaia Norte','Ajustar endereço/CEP',150),
('Shell Café Samambaia Sul','Ajustar endereço/CEP',150),
('Shell Café Riacho Fundo II','Ajustar endereço/CEP',150),
('Shell Café QS 07','Ajustar endereço/CEP',150),
('Point do Café Setor O','Ajustar endereço/CEP',150)
on conflict do nothing;
