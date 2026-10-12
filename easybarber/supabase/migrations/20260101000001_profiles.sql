-- profiles: one row per auth.users row. Holds the data the app needs
-- about a logged-in person, including the platform-admin flag.
-- is_platform_admin is intentionally NOT settable by the user who owns
-- the row (see RLS policy in 20260101000010_rls_policies.sql) — it can
-- only be granted by an existing platform admin, acting with the
-- service role or through a future admin-only RPC. There is no
-- hard-coded admin e-mail or password anywhere in this schema.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated person. is_platform_admin grants access to the cross-company admin area and must never be settable by the row owner.';

create index profiles_is_platform_admin_idx
  on public.profiles (id)
  where is_platform_admin;

-- Keep updated_at current on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created automatically whenever Supabase Auth creates
-- a new auth.users row, so the app never has to remember to do it (and
-- can never end up with an authenticated user who has no profile).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
