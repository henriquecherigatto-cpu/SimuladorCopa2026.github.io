-- Covers 20260101000036_whatsapp_cloud_api_schema.sql's new
-- multi-tenant surface: whatsapp_connections (each company's own
-- WhatsApp Business Account + encrypted token) and the functions that
-- read/write it. Required tests covered here: "Isolamento entre duas
-- barbearias diferentes" and the webhook's phone-matching isolation,
-- plus a reinforcement of the monotonic delivery-status update
-- (correct status progression on repeated/out-of-order events).

select test.act_as_superuser();

-- ---------------------------------------------------------------------
-- 1. Owner A connects company A's own WhatsApp account. Only
-- non-secret fields come back through get_whatsapp_connection_status()
-- — access_token_encrypted is never selectable through it at all (not
-- a masking choice, the function's own RETURNS TABLE simply has no
-- such column).
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);

select public.set_whatsapp_connection(
  :'company_a_id'::uuid, 'waba-a', 'phone-number-id-a', '+55 19 99999-0004',
  'iv:tag:ciphertext-a', null
);

select status, display_phone_number
from public.get_whatsapp_connection_status(:'company_a_id'::uuid) \gset conn_a_
select test.assert(:'conn_a_status' = 'connected', 'owner A sees company A as connected after set_whatsapp_connection()');
select test.assert(:'conn_a_display_phone_number' = '+55 19 99999-0004', 'owner A sees the display number it just connected');

-- ---------------------------------------------------------------------
-- 2. whatsapp_connections is granted only to service_role (plus RLS
-- with zero policies on top) — even company A's own owner cannot read
-- it directly at all. The function above is the ONLY read path, even
-- for the data's own company.
-- ---------------------------------------------------------------------
select test.assert_denied(
  format('select count(*) from public.whatsapp_connections where company_id = %L', :'company_a_id'),
  'owner A cannot read whatsapp_connections directly — only through get_whatsapp_connection_status()'
);

-- ---------------------------------------------------------------------
-- 3. Cross-company isolation: owner A cannot connect, read, or clear
-- company B's connection by simply passing company B's id — proves
-- altering the company id a request sends never grants access to
-- another barbershop's WhatsApp connection.
-- ---------------------------------------------------------------------
select test.assert_denied(
  format('select public.set_whatsapp_connection(%L, %L, %L, %L, %L, null)',
    :'company_b_id', 'waba-evil', 'phone-number-id-evil', '+55 00 00000-0000', 'iv:tag:evil'),
  'owner A cannot connect a WhatsApp account for company B by passing company B''s id'
);
select test.assert_denied(
  format('select public.get_whatsapp_connection_status(%L)', :'company_b_id'),
  'owner A cannot read company B''s WhatsApp connection status'
);
select test.assert_denied(
  format('select public.clear_whatsapp_connection(%L)', :'company_b_id'),
  'owner A cannot disconnect company B''s WhatsApp account'
);

-- ---------------------------------------------------------------------
-- 4. Owner-only, even for a genuine member of the SAME company: a
-- professional belonging to company A still cannot manage or read its
-- WhatsApp connection — stricter than "any company member."
-- ---------------------------------------------------------------------
select test.act_as(:'prof_a_user_id'::uuid);
select test.assert_denied(
  format('select public.get_whatsapp_connection_status(%L)', :'company_a_id'),
  'a professional (non-owner) of company A cannot read its own company''s WhatsApp connection status'
);
select test.assert_denied(
  format('select public.set_whatsapp_connection(%L, %L, %L, %L, %L, null)',
    :'company_a_id', 'waba-x', 'phone-x', '+55 19 90000-0000', 'iv:tag:x'),
  'a professional (non-owner) of company A cannot connect a WhatsApp account for their own company'
);
select test.assert_denied(
  format('select public.clear_whatsapp_connection(%L)', :'company_a_id'),
  'a professional (non-owner) of company A cannot disconnect their own company''s WhatsApp account'
);

-- ---------------------------------------------------------------------
-- 5. anon: none of the three authenticated-only functions are callable.
-- ---------------------------------------------------------------------
select test.act_as_anon();
select test.assert_denied(
  format('select public.get_whatsapp_connection_status(%L)', :'company_a_id'),
  'anon cannot read any company''s WhatsApp connection status'
);
select test.assert_denied(
  format('select public.set_whatsapp_connection(%L, %L, %L, %L, %L, null)',
    :'company_a_id', 'waba-x', 'phone-x', '+55 19 90000-0000', 'iv:tag:x'),
  'anon cannot connect a WhatsApp account for any company'
);
select test.assert_denied(
  format('select public.clear_whatsapp_connection(%L)', :'company_a_id'),
  'anon cannot disconnect any company''s WhatsApp account'
);

-- ---------------------------------------------------------------------
-- 6. service_role-only functions: denied to an ordinary owner and to
-- anon, confirmed working for service_role (the webhook/send path's
-- own role).
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format('select public.set_whatsapp_connection_error(%L, %L)', :'company_a_id', 'boom'),
  'an ordinary owner cannot call set_whatsapp_connection_error() — service_role only'
);
select test.assert_denied(
  format('select public.mark_customer_whatsapp_opt_out(%L, %L)', 'phone-number-id-a', '5519999990004'),
  'an ordinary owner cannot call mark_customer_whatsapp_opt_out() — service_role only'
);
select test.assert_denied(
  format('select public.update_whatsapp_message_status(%L, %L)', 'wamid.x', 'sent'),
  'an ordinary owner cannot call update_whatsapp_message_status() — service_role only'
);

select test.act_as_service_role();
select public.set_whatsapp_connection_error(:'company_a_id'::uuid, 'token expired');

-- get_whatsapp_connection_status() itself is owner/admin-only, so
-- read the result back as owner A, not as service_role.
select test.act_as(:'owner_a_id'::uuid);
select status, last_error
from public.get_whatsapp_connection_status(:'company_a_id'::uuid) \gset conn_a_err_
select test.assert(:'conn_a_err_status' = 'error', 'set_whatsapp_connection_error() (service_role) flips the connection to error');
select test.assert(:'conn_a_err_last_error' = 'token expired', 'the recorded error message is readable back through get_whatsapp_connection_status()');

-- ---------------------------------------------------------------------
-- 7. Disconnect: owner A can clear their own company's connection;
-- credentials and identifiers are wiped, not just the status flag.
-- ---------------------------------------------------------------------
select public.clear_whatsapp_connection(:'company_a_id'::uuid);
-- display_phone_number's null case is checked inline (rather than
-- comparing a \gset'd value against "is null" afterward) because
-- psql's \gset unsets the variable entirely for a null column value,
-- which breaks a later :'var' substitution.
select status, (display_phone_number is null) as display_phone_number_cleared
from public.get_whatsapp_connection_status(:'company_a_id'::uuid) \gset conn_a_cleared_
select test.assert(:'conn_a_cleared_status' = 'disconnected', 'clear_whatsapp_connection() resets status to disconnected');
select test.assert(:'conn_a_cleared_display_phone_number_cleared'::boolean is true, 'clear_whatsapp_connection() wipes the display number too');

select test.act_as_superuser();
select access_token_encrypted is null as token_wiped
from public.whatsapp_connections where company_id = :'company_a_id'::uuid \gset cleared_
select test.assert(:'cleared_token_wiped'::boolean is true, 'clear_whatsapp_connection() wipes the stored encrypted token itself, not just the status');

-- ---------------------------------------------------------------------
-- 8. Monotonic delivery-status updates (reinforces the required test
-- "atualizações corretas de status de entrega"): out-of-order or
-- duplicate webhook deliveries never move a message backward, and
-- 'failed' is terminal.
-- ---------------------------------------------------------------------
insert into public.whatsapp_messages (company_id, status, provider, provider_message_id, template)
values (:'company_a_id'::uuid, 'sent', 'meta_cloud_api', 'wamid.monotonic-test', 'booking_confirmation');

-- whatsapp_messages has no grant to service_role (or anyone) for a
-- bare SELECT/UPDATE — same as admin_company_overview()'s own note on
-- this table: it's function-only, both to write (log_whatsapp_message)
-- and to read (here, the harness's own superuser connection role, in
-- place of the real app's admin_company_overview()). So each check
-- below switches back to superuser to read, and to service_role (the
-- function's actual grantee) to call update_whatsapp_message_status().
select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.monotonic-test', 'delivered');
select test.act_as_superuser();
select status from public.whatsapp_messages where provider_message_id = 'wamid.monotonic-test' \gset mono_
select test.assert(:'mono_status' = 'delivered', 'status advances sent -> delivered');

select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.monotonic-test', 'sent');
select test.act_as_superuser();
select status from public.whatsapp_messages where provider_message_id = 'wamid.monotonic-test' \gset mono_
select test.assert(:'mono_status' = 'delivered', 'a late-arriving duplicate "sent" event never regresses an already-delivered message');

select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.monotonic-test', 'read');
select test.act_as_superuser();
select status from public.whatsapp_messages where provider_message_id = 'wamid.monotonic-test' \gset mono_
select test.assert(:'mono_status' = 'read', 'status advances delivered -> read');

select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.monotonic-test', 'failed', 'undeliverable');
select test.act_as_superuser();
select status, error from public.whatsapp_messages where provider_message_id = 'wamid.monotonic-test' \gset mono_
select test.assert(:'mono_status' = 'failed', 'status can move to the terminal failed state');
select test.assert(:'mono_error' = 'undeliverable', 'the failure reason is recorded');

select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.monotonic-test', 'read');
select test.act_as_superuser();
select status from public.whatsapp_messages where provider_message_id = 'wamid.monotonic-test' \gset mono_
select test.assert(:'mono_status' = 'failed', 'failed is terminal — a later "read" event never overwrites it');

select test.act_as_service_role();
select public.update_whatsapp_message_status('wamid.does-not-exist', 'read');
select test.assert(true, 'update_whatsapp_message_status() on an unknown provider_message_id is a silent no-op, not an error');

-- ---------------------------------------------------------------------
-- 9. Opt-out isolation: two different companies' customers who happen
-- to share the exact same phone digits — opting out via company A's
-- own phone_number_id must flip ONLY company A's customer, never
-- company B's, even though the digits match exactly.
-- ---------------------------------------------------------------------
select test.act_as_superuser();

update public.customers set phone = '19999990004' where id = :'customer_b_id'::uuid;

select test.act_as(:'owner_a_id'::uuid);
select public.set_whatsapp_connection(
  :'company_a_id'::uuid, 'waba-a', 'phone-number-id-opt-out-test', '+55 19 99999-0004',
  'iv:tag:ciphertext-a', null
);

select test.act_as_service_role();
select public.mark_customer_whatsapp_opt_out('phone-number-id-opt-out-test', '5519999990004');

select test.act_as_superuser();
select whatsapp_opt_out from public.customers where id = :'customer_a_id'::uuid \gset optout_a_
select whatsapp_opt_out from public.customers where id = :'customer_b_id'::uuid \gset optout_b_
select test.assert(:'optout_a_whatsapp_opt_out'::boolean is true, 'opting out via company A''s phone_number_id flips company A''s customer');
select test.assert(:'optout_b_whatsapp_opt_out'::boolean is false, 'company B''s customer with the exact same phone digits is untouched — opt-out is scoped by the company owning phone_number_id, not by phone digits alone');

-- Restore fixture state for any test file added after this one.
update public.customers set phone = '19999990006', whatsapp_opt_out = false where id = :'customer_b_id'::uuid;
update public.customers set whatsapp_opt_out = false where id = :'customer_a_id'::uuid;

select test.act_as(:'owner_a_id'::uuid);
select public.clear_whatsapp_connection(:'company_a_id'::uuid);

select test.act_as_superuser();

select test.assert(true, 'WhatsApp connections: owner-only management, zero direct table access, cross-company isolation (connection management and opt-out matching alike), service_role-only error/status/opt-out functions, and monotonic delivery-status updates all verified');
