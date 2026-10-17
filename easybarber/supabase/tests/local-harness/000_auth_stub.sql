-- Local-only stand-in for the parts of Supabase's `auth` schema our
-- migrations depend on (auth.users, auth.uid(), auth.role()).
--
-- THIS FILE IS NEVER RUN AGAINST A REAL SUPABASE PROJECT — a real
-- project already has the real `auth` schema. It exists purely so we
-- can apply supabase/migrations/*.sql unmodified against a throwaway
-- Postgres container and prove the RLS policies behave correctly,
-- without needing the full Supabase stack (GoTrue, PostgREST, etc).
--
-- The uid()/role() contracts below are copied from how Supabase's own
-- Postgres image defines them, so a policy that works here works
-- identically against the real thing.
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
  language sql stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable
  as $$
    select nullif(current_setting('request.jwt.claim.role', true), '')
  $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- Supabase's own platform bootstrap creates this empty publication on
-- every project; migrations that enable Realtime on a table (ALTER
-- PUBLICATION supabase_realtime ADD TABLE ...) assume it already
-- exists, same as they assume auth/anon/authenticated/service_role
-- above.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
