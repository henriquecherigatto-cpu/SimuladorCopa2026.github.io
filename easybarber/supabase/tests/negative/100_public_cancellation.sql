-- Public cancel-by-link (20260101000021_photos_whatsapp_cancellation.sql):
-- get_public_appointment_by_token() must be safe to call on a bare
-- page visit (never changes anything — a messaging app's link-preview
-- bot could hit it at any time), and cancel_appointment_by_token()
-- must only ever cancel a real, future, not-already-resolved
-- appointment, be idempotent, and never touch another company's rows
-- even by accident.
--
-- Reuses 000_fixtures.sql: appointment_a_id (Cliente A, company A,
-- tomorrow 10h, "agendado") and appointment_b_id (Cliente B, company
-- B, tomorrow 11h, "agendado").

select test.act_as_superuser();

select cancel_token from public.appointments where id = :'appointment_a_id'::uuid \gset a_
select cancel_token from public.appointments where id = :'appointment_b_id'::uuid \gset b_

-- ---------------------------------------------------------------------
-- 1. Read-only lookup: correct details, correct can_cancel, and an
-- unknown token never errors.
-- ---------------------------------------------------------------------
select test.act_as_anon();

select
  r.result ->> 'company_name' as company_name,
  r.result ->> 'service_name' as service_name,
  r.result ->> 'status' as status,
  (r.result ->> 'can_cancel')::boolean as can_cancel
from (select public.get_public_appointment_by_token(:'a_cancel_token'::uuid) as result) r \gset lookup_

select test.assert(:'lookup_company_name' = 'Barber 013', 'lookup returns the correct company name for appointment A''s token');
select test.assert(:'lookup_service_name' = 'Corte de cabelo', 'lookup returns the correct service name for appointment A''s token');
select test.assert(:'lookup_status' = 'agendado', 'appointment A starts out agendado');
select test.assert(:'lookup_can_cancel'::boolean, 'a future, agendado appointment can be cancelled');

select (r.result ->> 'found')::boolean as found
from (select public.get_public_appointment_by_token(gen_random_uuid()) as result) r \gset unknown_
select test.assert(not :'unknown_found'::boolean, 'an unknown token is reported as not found, not an error');

-- A bare lookup must never itself cancel anything — re-checking right
-- after confirms the status is still untouched.
select (r.result ->> 'status') as status
from (select public.get_public_appointment_by_token(:'a_cancel_token'::uuid) as result) r \gset stillagendado_
select test.assert(:'stillagendado_status' = 'agendado', 'looking an appointment up by token never cancels it on its own');

-- ---------------------------------------------------------------------
-- 2. Cancelling for real: status flips, and the professional's slot
-- reopens — the whole point of the feature.
-- ---------------------------------------------------------------------
select (r.result ->> 'status') as status
from (select public.cancel_appointment_by_token(:'a_cancel_token'::uuid) as result) r \gset cancelled_

select test.assert(:'cancelled_status' = 'cancelado', 'cancel_appointment_by_token flips the status to cancelado');

select test.act_as_superuser();
select status from public.appointments where id = :'appointment_a_id'::uuid \gset dbstate_
select test.assert(:'dbstate_status' = 'cancelado', 'the cancellation is actually persisted in the appointments table');

-- The 10h-10:45 slot for professional A is bookable again now that
-- its only occupant was cancelled.
select exists (
  select 1 from public.get_available_slots(:'company_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid, current_date + 1)
  where slot_start = '10:00'
) as reopened \gset
select test.assert(:'reopened'::boolean, 'cancelling by link frees up the professional''s slot for new bookings');

-- ---------------------------------------------------------------------
-- 3. Idempotency: cancelling an already-cancelled appointment again
-- just reports its current state, no error, no side effect.
-- ---------------------------------------------------------------------
select test.act_as_anon();

select
  (r.result ->> 'status') as status,
  (r.result ->> 'can_cancel')::boolean as can_cancel
from (select public.cancel_appointment_by_token(:'a_cancel_token'::uuid) as result) r \gset again_

select test.assert(:'again_status' = 'cancelado', 'cancelling an already-cancelled appointment again is a no-op, still reports cancelado');
select test.assert(not :'again_can_cancel'::boolean, 'an already-cancelled appointment reports can_cancel = false');

-- ---------------------------------------------------------------------
-- 4. A concluded appointment can never be "un-concluded" via this
-- door — mark company B's appointment concluido as its owner, then
-- confirm the public cancel link refuses to touch it.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_b_id'::uuid);
update public.appointments set status = 'concluido' where id = :'appointment_b_id'::uuid;

select test.act_as_anon();
select
  (r.result ->> 'status') as status,
  (r.result ->> 'can_cancel')::boolean as can_cancel
from (select public.get_public_appointment_by_token(:'b_cancel_token'::uuid) as result) r \gset concl_
select test.assert(:'concl_status' = 'concluido', 'a concluded appointment keeps its status in the lookup');
select test.assert(not :'concl_can_cancel'::boolean, 'a concluded appointment cannot be cancelled by link');

select (r.result ->> 'status') as status
from (select public.cancel_appointment_by_token(:'b_cancel_token'::uuid) as result) r \gset conclcancel_
select test.assert(:'conclcancel_status' = 'concluido', 'attempting to cancel a concluded appointment by link leaves it concluido, not cancelado');

-- ---------------------------------------------------------------------
-- 5. A past appointment (even if still "agendado" because nobody
-- marked it concluido) cannot be cancelled either — cancelling the
-- past makes no sense and must not silently "succeed".
-- ---------------------------------------------------------------------
select test.act_as_superuser();

insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, status, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a2_id'::uuid, :'service_a_id'::uuid,
  ((current_date - 1 + interval '10 hour') at time zone 'America/Sao_Paulo'),
  ((current_date - 1 + interval '10 hour 45 minute') at time zone 'America/Sao_Paulo'), 'agendado', :'owner_a_id'::uuid
)
returning id, cancel_token \gset past_

select test.act_as_anon();
select (r.result ->> 'can_cancel')::boolean as can_cancel
from (select public.get_public_appointment_by_token(:'past_cancel_token'::uuid) as result) r \gset pastlookup_
select test.assert(not :'pastlookup_can_cancel'::boolean, 'a past appointment cannot be cancelled by link, even if still agendado');

select (r.result ->> 'status') as status
from (select public.cancel_appointment_by_token(:'past_cancel_token'::uuid) as result) r \gset pastcancel_
select test.assert(:'pastcancel_status' = 'agendado', 'attempting to cancel a past appointment by link leaves its status untouched');

select test.act_as_superuser();

select test.assert(true, 'public cancel-by-link: lookup safety, real cancellation, slot reopening, idempotency and past/concluded guards all verified');
