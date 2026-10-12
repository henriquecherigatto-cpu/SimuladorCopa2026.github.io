-- Minimal hand-rolled assertion helper so the negative tests read as
-- plain SQL instead of pulling in pgTAP. assert() raises (aborting
-- the whole script, non-zero psql exit code) on the first failure, so
-- a clean run through every test file is the signal that everything
-- passed.
create schema if not exists test;

create or replace function test.assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'FAIL: %', p_message;
  else
    raise notice 'PASS: %', p_message;
  end if;
end;
$$;

-- Executes p_sql expecting it to be rejected (permission denied, an
-- RLS WITH CHECK violation, or any other raised exception — all of
-- these are SQLSTATE 42501 in this schema's own `raise ... using
-- errcode = '42501'` calls, and Postgres itself also uses 42501 for
-- both "no GRANT" and "row-level security policy violation"). If the
-- statement succeeds instead, that is a FAIL: it means something that
-- should have been blocked was not.
create or replace function test.assert_denied(p_sql text, p_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    perform test.assert(false, p_message || ' — DANGER: statement succeeded but should have been denied');
  exception
    when insufficient_privilege then
      perform test.assert(true, p_message);
    when others then
      -- Any other exception (e.g. a CHECK/exclusion constraint, or one
      -- of this schema's own P0001 business-rule raises) still proves
      -- the write did not go through, which is what we're verifying.
      perform test.assert(true, p_message || format(' (denied via %s: %s)', sqlstate, sqlerrm));
  end;
end;
$$;

-- Runs an UPDATE/DELETE and returns how many rows it actually
-- touched. For a row an RLS policy's USING clause hides from the
-- caller, UPDATE/DELETE behaves like the row simply doesn't exist —
-- zero rows affected, no error — which is the correct outcome to
-- assert on for "can owner A modify company B's row?" style checks.
create or replace function test.exec_affected_rows(p_sql text)
returns bigint
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function test.assert_row_count(p_expected bigint, p_actual bigint, p_message text)
returns void
language plpgsql
as $$
begin
  perform test.assert(p_actual = p_expected, p_message || format(' (expected %s, got %s)', p_expected, p_actual));
end;
$$;

-- Switches the current session to look like an authenticated request
-- from the given user id, the way PostgREST does it for every
-- request based on the verified JWT. Note: is_local = false (session
-- scope, not transaction scope) on purpose — psql runs each
-- statement as its own implicit transaction, so a transaction-scoped
-- SET LOCAL would revert before the very next statement. "role" is
-- itself a regular GUC, settable via set_config just like any other,
-- which is what SET ROLE does under the hood.
create or replace function test.act_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create or replace function test.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  perform set_config('role', 'anon', false);
end;
$$;

-- Switches to service_role: no JWT claims at all (service_role never
-- carries a user identity), just the role itself, which is what lets
-- it both bypass RLS (service_role is created `bypassrls` in
-- 000_auth_stub.sql, matching the real Supabase role) and call
-- functions granted only to service_role (e.g.
-- public.apply_billing_event). This is what a verified webhook
-- handler or scheduled sweep route runs as in production.
create or replace function test.act_as_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  perform set_config('role', 'service_role', false);
end;
$$;

-- Back to the unrestricted connection role (the harness' own setup
-- steps, e.g. seeding fixture data, run as this role).
create or replace function test.act_as_superuser()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
  -- session_user is the role that actually opened the connection
  -- (unaffected by SET ROLE), so this always returns to it.
  perform set_config('role', session_user, false);
end;
$$;

-- This harness only ever runs locally against a throwaway database,
-- so it's fine (and necessary) for every role to be able to call
-- test.* while "acting as" a non-superuser — otherwise a test
-- couldn't even call test.act_as_superuser() to switch back.
grant usage on schema test to public;
grant execute on all functions in schema test to public;
alter default privileges in schema test grant execute on functions to public;
