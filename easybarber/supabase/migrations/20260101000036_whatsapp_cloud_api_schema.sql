-- Part 2/2 of the Twilio -> WhatsApp Cloud API (Meta) migration.
--
-- Twilio used ONE platform-wide sender for every company (see the
-- now-outdated design note this migration supersedes, in
-- docs/whatsapp-integration.md). The Cloud API migration makes this
-- genuinely multi-tenant: each company connects its OWN WhatsApp
-- Business Account (via Meta's Embedded Signup — see
-- src/lib/actions/whatsapp-connection.ts), so each company needs its
-- own phone_number_id/waba_id/access token stored. This migration adds:
--   1. whatsapp_connections — one row per company, holding that
--      connection + the access token, ENCRYPTED (AES-256-GCM in
--      application code — src/lib/whatsapp/token-crypto.ts — never in
--      plaintext here; the decryption key is a server-only env var,
--      never stored in the database).
--   2. customers.whatsapp_opt_out — consent/unsubscribe tracking.
--   3. whatsapp_messages.template — which outbound message kind each
--      log row is, needed so a send can check "did THIS appointment's
--      THIS template already go out" before sending again (retry/duplicate
--      prevention).
--   4. update_whatsapp_message_status() — the webhook's write path
--      (log_whatsapp_message() is insert-only); monotonic so an
--      out-of-order or duplicate webhook delivery can never regress a
--      message backward (e.g. 'read' back to 'delivered').

-- ---------------------------------------------------------------------
-- whatsapp_connections
-- ---------------------------------------------------------------------
create type public.whatsapp_connection_status as enum (
  'disconnected', 'connecting', 'connected', 'error'
);

create table public.whatsapp_connections (
  company_id uuid primary key references public.companies (id) on delete cascade,
  status public.whatsapp_connection_status not null default 'disconnected',
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  -- AES-256-GCM ciphertext ("iv:authTag:ciphertext", base64), produced
  -- and consumed only by src/lib/whatsapp/token-crypto.ts. Never
  -- decrypted in SQL, never readable by any client role (see the zero
  -- RLS policies below) — a stolen database dump is useless without
  -- the separate WHATSAPP_TOKEN_ENCRYPTION_KEY env var, which never
  -- leaves the server and is never stored in this database.
  access_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whatsapp_connections is
  'One row per company: that company''s own WhatsApp Business Account connection (phone_number_id/waba_id) and its encrypted access token. Zero RLS policies, same reasoning as whatsapp_messages but one level more sensitive (this table holds live API credentials) — reachable only through service-role server code (the Meta API calls themselves) and get_whatsapp_connection_status()/set_whatsapp_connection()/clear_whatsapp_connection() below, never a direct client read, not even the company''s own owner.';

alter table public.whatsapp_connections enable row level security;
-- Deliberately no policies — see table comment.

grant select, insert, update, delete on public.whatsapp_connections to service_role;

create trigger whatsapp_connections_set_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- get_whatsapp_connection_status: the UI's one read path for this
-- table — returns only non-secret fields, never the encrypted token.
-- ---------------------------------------------------------------------
create or replace function public.get_whatsapp_connection_status(p_company_id uuid)
returns table (
  status public.whatsapp_connection_status,
  display_phone_number text,
  connected_at timestamptz,
  last_error text,
  token_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.has_company_role(p_company_id, array['owner']::public.company_member_role[])
    or public.is_platform_admin()
  ) then
    raise exception 'Not authorized to view this company''s WhatsApp connection.'
      using errcode = '42501';
  end if;

  return query
  select c.status, c.display_phone_number, c.connected_at, c.last_error, c.token_expires_at
  from public.whatsapp_connections c
  where c.company_id = p_company_id;
end;
$$;

comment on function public.get_whatsapp_connection_status is
  'Owner-or-admin-only, non-secret view of a company''s WhatsApp connection — never returns access_token_encrypted.';

revoke all on function public.get_whatsapp_connection_status(uuid) from public;
grant execute on function public.get_whatsapp_connection_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- set_whatsapp_connection / clear_whatsapp_connection: the only writes
-- to this table reachable from the app. Called from the owner's own
-- authenticated session (not service_role) — has_company_role() is the
-- real authorization boundary, same as every other owner-only write in
-- this schema. The access token is encrypted in TypeScript BEFORE it
-- ever reaches this function; these functions only ever handle
-- ciphertext.
-- ---------------------------------------------------------------------
create or replace function public.set_whatsapp_connection(
  p_company_id uuid,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_access_token_encrypted text,
  p_token_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_company_role(p_company_id, array['owner']::public.company_member_role[]) then
    raise exception 'Only the company owner can connect a WhatsApp account.'
      using errcode = '42501';
  end if;
  if p_waba_id is null or p_phone_number_id is null or p_access_token_encrypted is null then
    raise exception 'waba_id, phone_number_id and an access token are all required to connect.'
      using errcode = '22023';
  end if;

  insert into public.whatsapp_connections (
    company_id, status, waba_id, phone_number_id, display_phone_number,
    access_token_encrypted, token_expires_at, connected_at, last_error
  )
  values (
    p_company_id, 'connected', p_waba_id, p_phone_number_id, p_display_phone_number,
    p_access_token_encrypted, p_token_expires_at, now(), null
  )
  on conflict (company_id) do update set
    status = 'connected',
    waba_id = excluded.waba_id,
    phone_number_id = excluded.phone_number_id,
    display_phone_number = excluded.display_phone_number,
    access_token_encrypted = excluded.access_token_encrypted,
    token_expires_at = excluded.token_expires_at,
    connected_at = now(),
    last_error = null;

  perform public.write_audit_log(
    p_company_id, 'whatsapp_connected', 'company', p_company_id,
    jsonb_build_object('phone_number_id', p_phone_number_id, 'waba_id', p_waba_id)
  );
end;
$$;

revoke all on function public.set_whatsapp_connection(uuid, text, text, text, text, timestamptz) from public;
grant execute on function public.set_whatsapp_connection(uuid, text, text, text, text, timestamptz) to authenticated;

create or replace function public.clear_whatsapp_connection(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_company_role(p_company_id, array['owner']::public.company_member_role[]) then
    raise exception 'Only the company owner can disconnect a WhatsApp account.'
      using errcode = '42501';
  end if;

  update public.whatsapp_connections
  set status = 'disconnected',
      waba_id = null,
      phone_number_id = null,
      display_phone_number = null,
      access_token_encrypted = null,
      token_expires_at = null,
      last_error = null
  where company_id = p_company_id;

  perform public.write_audit_log(
    p_company_id, 'whatsapp_disconnected', 'company', p_company_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.clear_whatsapp_connection(uuid) from public;
grant execute on function public.clear_whatsapp_connection(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- set_whatsapp_connection_error: records a connection/send-time error
-- (e.g. the token expired, Meta revoked access) for display in the UI,
-- without tearing down the stored credentials — distinct from
-- clear_whatsapp_connection(), which the owner triggers explicitly.
-- Called from trusted server code (service_role), not the owner's own
-- session, since this fires from background send/webhook paths.
-- ---------------------------------------------------------------------
create or replace function public.set_whatsapp_connection_error(p_company_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.whatsapp_connections
  set status = 'error', last_error = p_error
  where company_id = p_company_id;
$$;

revoke all on function public.set_whatsapp_connection_error(uuid, text) from public;
grant execute on function public.set_whatsapp_connection_error(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- customers: consent / opt-out tracking (spec 4.1 §6 — "verificar o
-- consentimento do cliente... respeitar solicitações de cancelamento").
-- Defaults to false (opted IN): a customer who just typed their own
-- phone number into a booking form has, by that action, implicitly
-- consented to a transactional confirmation about the booking they
-- just made — this is not marketing. An explicit opt-out (the
-- customer replying a stop keyword — see the webhook handler) is what
-- flips it, and is permanent until they book again.
-- ---------------------------------------------------------------------
alter table public.customers add column whatsapp_opt_out boolean not null default false;
alter table public.customers add column whatsapp_opted_out_at timestamptz;

-- ---------------------------------------------------------------------
-- whatsapp_messages: which template, for duplicate-send prevention
-- (sendBookingConfirmation() checks "does a non-failed row for this
-- appointment_id + template already exist" before calling the
-- provider), plus an index so the webhook can find a row by Meta's
-- message id quickly.
-- ---------------------------------------------------------------------
alter table public.whatsapp_messages add column template text;

-- Adding a parameter — even a defaulted one — changes the function's
-- argument-type signature, so CREATE OR REPLACE would create a SECOND,
-- overloaded function here instead of replacing the existing one
-- (confirmed the hard way: the old 6-arg and new 7-arg overloads then
-- made every named-parameter call ambiguous, "not unique"). Same
-- drop + create pattern as every other signature change in this
-- schema (see 20260101000033_admin_plan_change.sql's own note on this).
drop function if exists public.log_whatsapp_message(public.whatsapp_message_status, text, uuid, uuid, text, text);

create function public.log_whatsapp_message(
  p_status public.whatsapp_message_status,
  p_provider text,
  p_appointment_id uuid default null,
  p_company_id uuid default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_template text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if p_appointment_id is not null then
    select company_id into v_company_id from public.appointments where id = p_appointment_id;
  else
    v_company_id := p_company_id;
  end if;

  if v_company_id is null then
    return;
  end if;

  insert into public.whatsapp_messages (
    company_id, appointment_id, status, provider, provider_message_id, error, template
  )
  values (
    v_company_id, p_appointment_id, p_status, p_provider, p_provider_message_id, p_error, p_template
  );
end;
$$;

revoke all on function public.log_whatsapp_message(public.whatsapp_message_status, text, uuid, uuid, text, text, text) from public;
grant execute on function public.log_whatsapp_message(public.whatsapp_message_status, text, uuid, uuid, text, text, text) to service_role;

create index whatsapp_messages_provider_message_id_idx
  on public.whatsapp_messages (provider_message_id)
  where provider_message_id is not null;

create index whatsapp_messages_appointment_template_idx
  on public.whatsapp_messages (appointment_id, template)
  where appointment_id is not null and template is not null;

-- ---------------------------------------------------------------------
-- update_whatsapp_message_status: the webhook's write path.
-- log_whatsapp_message() is insert-only (one row per send attempt);
-- this is the only way a row's status changes afterward. Monotonic by
-- design — Meta's webhook delivery is at-least-once, and events can
-- arrive out of order, so a duplicate or late-arriving 'sent'/'delivered'
-- event can never regress a message that's already 'read', and
-- 'failed' (terminal) is never overwritten by a later status.
-- ---------------------------------------------------------------------
create or replace function public.update_whatsapp_message_status(
  p_provider_message_id text,
  p_status public.whatsapp_message_status,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.whatsapp_message_status;
  v_rank constant jsonb := '{"sent": 1, "delivered": 2, "read": 3, "failed": 4}'::jsonb;
begin
  select status into v_current
  from public.whatsapp_messages
  where provider_message_id = p_provider_message_id
  order by created_at desc
  limit 1;

  if not found then
    -- Unknown message id (not one this app sent, or an event for a
    -- company/template this schema doesn't track) — nothing to update,
    -- not an error.
    return;
  end if;

  if v_current = 'failed' then
    return;
  end if;
  if p_status != 'failed'
     and (v_rank -> v_current::text)::int >= (v_rank -> p_status::text)::int then
    return;
  end if;

  update public.whatsapp_messages
  set status = p_status, error = coalesce(p_error, error)
  where provider_message_id = p_provider_message_id;
end;
$$;

comment on function public.update_whatsapp_message_status is
  'Webhook-driven status update for a previously-logged message, found by Meta''s own message id (provider_message_id). Monotonic (sent -> delivered -> read; failed is terminal) so an at-least-once, possibly out-of-order webhook delivery is always safe to apply more than once.';

revoke all on function public.update_whatsapp_message_status(text, public.whatsapp_message_status, text) from public;
grant execute on function public.update_whatsapp_message_status(text, public.whatsapp_message_status, text) to service_role;

-- ---------------------------------------------------------------------
-- mark_customer_whatsapp_opt_out: the webhook's handler for an inbound
-- "PARAR"/"SAIR"/"STOP" reply (spec 4.1 §6 — respecting an opt-out
-- request). customers.phone is stored exactly as typed on the public
-- booking form (see get_public_customer_appointments() — compared with
-- a plain btrim(), no digit normalization), while Meta's webhook
-- always sends the sender's number as digits-only with the country
-- code (e.g. "5519999999999") — this function is the one place that
-- normalizes both sides (regexp_replace strips non-digits) before
-- comparing, rather than assuming a format customers.phone was never
-- actually guaranteed to have. Tries both with and without the "55"
-- country code, since a locally-typed number may have been stored
-- without it.
-- ---------------------------------------------------------------------
create or replace function public.mark_customer_whatsapp_opt_out(
  p_phone_number_id text,
  p_from_phone_digits text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.whatsapp_connections
  where phone_number_id = p_phone_number_id;

  if v_company_id is null then
    return;
  end if;

  update public.customers
  set whatsapp_opt_out = true, whatsapp_opted_out_at = now()
  where company_id = v_company_id
    and regexp_replace(phone, '\D', '', 'g') in (
      p_from_phone_digits,
      regexp_replace(p_from_phone_digits, '^55', '')
    );
end;
$$;

comment on function public.mark_customer_whatsapp_opt_out is
  'Flags every customer of the company owning phone_number_id whose (digit-normalized) phone matches the inbound sender as opted out of WhatsApp confirmations. A no-op, not an error, when the phone number id or the customer isn''t found.';

revoke all on function public.mark_customer_whatsapp_opt_out(text, text) from public;
grant execute on function public.mark_customer_whatsapp_opt_out(text, text) to service_role;
