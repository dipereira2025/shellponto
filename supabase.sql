-- SHELL CAFÉ PONTO V3 HTML + SUPABASE
-- Rode no Supabase > SQL Editor

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin', 'employee');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type punch_type as enum ('entrada', 'saida_intervalo', 'volta_intervalo', 'saida');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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
  type punch_type not null,
  punched_at timestamptz not null default now(),
  latitude numeric not null,
  longitude numeric not null,
  distance_meters numeric,
  selfie_path text,
  note text,
  device_info text,
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

alter table profiles enable row level security;
alter table time_punches enable row level security;
alter table audit_logs enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
    and active = true
  );
$$;

drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert_admin" on profiles;
drop policy if exists "profiles_update_admin" on profiles;

create policy "profiles_select"
on profiles for select
using (id = auth.uid() or is_admin());

create policy "profiles_insert_admin"
on profiles for insert
with check (is_admin());

create policy "profiles_update_admin"
on profiles for update
using (is_admin())
with check (is_admin());

drop policy if exists "punch_select" on time_punches;
drop policy if exists "punch_insert_own" on time_punches;
drop policy if exists "punch_update_admin" on time_punches;
drop policy if exists "punch_delete_admin" on time_punches;

create policy "punch_select"
on time_punches for select
using (user_id = auth.uid() or is_admin());

create policy "punch_insert_own"
on time_punches for insert
with check (user_id = auth.uid());

create policy "punch_update_admin"
on time_punches for update
using (is_admin())
with check (is_admin());

create policy "punch_delete_admin"
on time_punches for delete
using (is_admin());

drop policy if exists "audit_select_admin" on audit_logs;
drop policy if exists "audit_insert_auth" on audit_logs;

create policy "audit_select_admin"
on audit_logs for select
using (is_admin());

create policy "audit_insert_auth"
on audit_logs for insert
with check (actor_id = auth.uid());

-- STORAGE
-- Crie manualmente o bucket: ponto-selfies
-- Supabase > Storage > New bucket > ponto-selfies > private

drop policy if exists "selfies_read" on storage.objects;
drop policy if exists "selfies_insert" on storage.objects;

create policy "selfies_read"
on storage.objects for select
using (
  bucket_id = 'ponto-selfies'
  and (is_admin() or owner = auth.uid())
);

create policy "selfies_insert"
on storage.objects for insert
with check (
  bucket_id = 'ponto-selfies'
  and owner = auth.uid()
);
