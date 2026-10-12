-- Privilege-escalation and platform-admin-boundary checks.
select test.act_as(:'owner_a_id'::uuid);

-- A regular user can never grant themselves platform-admin rights,
-- no matter how the UPDATE is phrased.
select test.assert_denied(
  format('update public.profiles set is_platform_admin = true where id = %L', :'owner_a_id'),
  'owner A cannot set their own is_platform_admin to true');

-- ...and the flag really is still false afterwards (the BEFORE UPDATE
-- trigger rolled the attempted change back, not just RLS).
select test.assert(
  not coalesce((select is_platform_admin from public.profiles where id = :'owner_a_id'::uuid), true),
  'owner A''s is_platform_admin remains false after the attempted escalation');

-- Non-admin cannot call the admin-only aggregate functions.
select test.assert_denied('select * from public.admin_company_overview()',
  'owner A cannot call admin_company_overview()');
select test.assert_denied('select * from public.admin_platform_metrics()',
  'owner A cannot call admin_platform_metrics()');

-- Non-admin cannot read platform-level (company_id is null) audit
-- log entries, nor another company's entries.
select test.assert_row_count(0, count(*), 'owner A cannot read company B''s audit log entries')
  from public.audit_logs where company_id = :'company_b_id'::uuid;

select test.assert_row_count(0, count(*), 'owner A cannot read platform-level audit log entries')
  from public.audit_logs where company_id is null;

-- Owner A CAN see their own company's audit trail (e.g. the
-- "company_created" entry written by create_company_with_owner()).
select test.assert(count(*) > 0, 'owner A can read their own company''s audit log entries')
  from public.audit_logs where company_id = :'company_a_id'::uuid;

-- Nobody can write audit_logs directly from the client — only
-- write_audit_log() (SECURITY DEFINER, called from triggers) can.
select test.assert_denied(
  format('insert into public.audit_logs (actor_profile_id, company_id, action, target_type) values (%L, %L, %L, %L)',
    :'owner_a_id', :'company_a_id', 'fake_entry', 'company'),
  'owner A cannot insert a forged audit_logs row directly');

-- Nobody can write billing_events from the client either — only the
-- service role (the verified webhook handler) can, which bypasses
-- RLS entirely and so needs no policy here at all.
select test.assert_denied(
  format('insert into public.billing_events (company_id, provider_event_id, event_type, status) values (%L, %L, %L, %L)',
    :'company_a_id', 'evt_fake_1', 'payment_confirmed', 'pago'),
  'owner A cannot insert a forged billing_events row directly (would let them self-mark a payment as made)');

select test.act_as_superuser();
