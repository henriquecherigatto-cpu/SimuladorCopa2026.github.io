-- Public self-service booking (20260101000018_public_booking.sql):
-- get_public_booking_page / get_public_available_slots /
-- create_public_appointment are the ONLY doors `anon` has into this
-- schema. Every assertion here runs as anon (test.act_as_anon()) to
-- prove the public booking page works for a real, logged-out visitor
-- — and that it still can't reach anything beyond what it's supposed
-- to, including another company's data via a mismatched slug/id
-- combination.
--
-- Uses company_a_id/professional_a_id/service_a_id etc. from
-- 000_fixtures.sql ("Barber 013", with professional "Carlos (A)" and
-- service "Corte de cabelo") as the company being booked through, and
-- company_b_id/professional_b_id/service_b_id ("Navalha Club") as the
-- cross-company tamper target.

select test.act_as_superuser();

select slug from public.companies where id = :'company_a_id'::uuid \gset a_
select slug from public.companies where id = :'company_b_id'::uuid \gset b_

select test.assert(:'a_slug' is not null and :'a_slug' <> '', 'company A got a non-empty slug at signup');
select test.assert(:'a_slug' <> :'b_slug', 'company A and company B have distinct slugs');

-- ---------------------------------------------------------------------
-- 1. Access control: anon cannot read the raw tables directly —
-- the public booking surface is exactly the three functions below,
-- nothing opened up at the RLS/table level.
-- ---------------------------------------------------------------------
select test.act_as_anon();

select test.assert_denied(
  'select count(*) from public.companies',
  'anon has no direct SELECT on companies (no table-level GRANT — see 20260101000014_grants.sql, which only grants to authenticated)'
);
select test.assert_denied(
  'select count(*) from public.professionals',
  'anon has no direct SELECT on professionals'
);
select test.assert_denied(
  'select count(*) from public.services',
  'anon has no direct SELECT on services'
);
select test.assert_denied(
  'select count(*) from public.appointments',
  'anon has no direct SELECT on appointments'
);

select test.assert_denied(
  format('select * from public.get_available_slots(%L, %L, %L, current_date + 1)', :'company_a_id', :'professional_a_id', :'service_a_id'),
  'anon cannot call the authenticated-only get_available_slots directly (only the public wrapper, which re-validates everything, is reachable)'
);

-- ---------------------------------------------------------------------
-- 2. get_public_booking_page: returns exactly company A's public data
-- when given company A's slug — and never company B's.
-- ---------------------------------------------------------------------
select public.get_public_booking_page(:'a_slug') as page_a \gset

select (:'page_a'::jsonb -> 'company' ->> 'name') as ok \gset
select test.assert(:'ok' = 'Barber 013', 'get_public_booking_page returns company A''s name for company A''s slug');

select ((:'page_a'::jsonb -> 'services') @> '[{"name": "Corte de cabelo"}]'::jsonb) as ok \gset
select test.assert(:'ok'::boolean, 'company A''s active service (Corte de cabelo) is listed');

select ((:'page_a'::jsonb -> 'professionals') @> '[{"name": "Carlos (A)"}]'::jsonb) as ok \gset
select test.assert(:'ok'::boolean, 'company A''s active professional (Carlos (A)) is listed');

select not ((:'page_a'::jsonb::text) ilike '%Navalha%') as ok \gset
select test.assert(:'ok'::boolean, 'company B''s name never appears in company A''s public booking page');
select not ((:'page_a'::jsonb::text) ilike '%Matheus%') as ok \gset
select test.assert(:'ok'::boolean, 'company B''s professional never appears in company A''s public booking page');
select not ((:'page_a'::jsonb::text) ilike '%Barba%') as ok \gset
select test.assert(:'ok'::boolean, 'company B''s service never appears in company A''s public booking page');

-- A slug that doesn't exist: no error, just an empty/null shape —
-- the page component treats a null "company" as 404, never a crash.
select public.get_public_booking_page('this-slug-does-not-exist') as page_missing \gset
select (:'page_missing'::jsonb -> 'company') as ok \gset
select test.assert(:'ok' = 'null', 'an unknown slug returns company: null, not an error');

-- ---------------------------------------------------------------------
-- 3. get_public_available_slots: works for a real (slug, professional,
-- service) combination from the same company, and returns nothing —
-- never an error, never another company's availability — for a
-- mismatched one.
-- ---------------------------------------------------------------------
select count(*) as n from public.get_public_available_slots(:'a_slug', :'professional_a_id'::uuid, :'service_a_id'::uuid, current_date + 2) \gset slots_
select test.assert(:slots_n > 0, 'get_public_available_slots returns bookable slots for a valid same-company combination');

-- company A's slug, but company B's professional: must be empty, not
-- an error and not company B's real availability.
select count(*) as n from public.get_public_available_slots(:'a_slug', :'professional_b_id'::uuid, :'service_a_id'::uuid, current_date + 2) \gset mismatch_
select test.assert_row_count(0, :mismatch_n, 'cross-company professional_id under company A''s slug yields no slots, not company B''s data');

-- ---------------------------------------------------------------------
-- 4. create_public_appointment: the actual booking write path.
-- ---------------------------------------------------------------------

-- Cross-company tamper attempt must be rejected outright.
select test.assert_denied(
  format(
    $sql$select public.create_public_appointment(%L, %L, %L, current_date + 3, '09:00', 'Visitante', '19900000000')$sql$,
    :'a_slug', :'service_a_id', :'professional_b_id'
  ),
  'create_public_appointment rejects a professional_id from a different company than the slug'
);

-- A real booking, as a genuine anonymous visitor would make it.
-- create_public_appointment returns jsonb — id/cancel_token plus the
-- same display fields get_public_appointment_by_token() would return
-- for that token (company_name, service_name, professional_name,
-- starts_at) — not a bare uuid, so the WhatsApp confirmation message
-- (composed in sendBookingConfirmation(), src/lib/actions/public-booking.ts)
-- is always built from server-confirmed data, never client-held form state.
select
  r.result ->> 'id' as appt_id,
  r.result ->> 'company_name' as booking_company_name,
  r.result ->> 'service_name' as booking_service_name,
  r.result ->> 'professional_name' as booking_professional_name,
  (r.result ->> 'can_cancel')::boolean as booking_can_cancel
from (select public.create_public_appointment(
  :'a_slug', :'service_a_id'::uuid, :'professional_a_id'::uuid, current_date + 3, '09:00',
  'Cliente Público', '19988887777', 'cliente.publico@example.com', 'Agendado pelo link público'
) as result) r \gset

select test.assert(:'booking_company_name' = 'Barber 013', 'create_public_appointment''s result includes the correct company_name for the confirmation message');
select test.assert(:'booking_service_name' = 'Corte de cabelo', 'create_public_appointment''s result includes the correct service_name for the confirmation message');
select test.assert(:'booking_professional_name' = 'Carlos (A)', 'create_public_appointment''s result includes the correct professional_name for the confirmation message');
select test.assert(:'booking_can_cancel'::boolean, 'a freshly booked future appointment reports can_cancel = true in create_public_appointment''s own result');

select test.act_as_superuser();

select company_id, created_by is null as created_by_is_null, status
from public.appointments where id = :'appt_id'::uuid \gset booked_

select test.assert(:'booked_company_id' = :'company_a_id', 'the public booking landed on company A, matching the slug used');
select test.assert(:'booked_created_by_is_null'::boolean, 'a public booking has no created_by (no profile exists for an anonymous visitor)');
select test.assert(:'booked_status' = 'agendado', 'the public booking starts in agendado status, same as any other new appointment');

select id, phone from public.customers
where company_id = :'company_a_id'::uuid and phone = '19988887777' \gset cust_
select test.assert(:'cust_phone' = '19988887777', 'a customer row was created from the public booking''s name/phone');

-- Booking again with the SAME phone must reuse the same customer, not
-- create a duplicate — same rule the authenticated flow follows.
select test.act_as_anon();

select r.result ->> 'id' as appt_id_2
from (select public.create_public_appointment(
  :'a_slug', :'service_a_id'::uuid, :'professional_a_id'::uuid, current_date + 4, '09:00',
  'Cliente Público', '19988887777'
) as result) r \gset

select test.act_as_superuser();
select customer_id from public.appointments where id = :'appt_id_2'::uuid \gset appt2_
select test.assert(:'appt2_customer_id' = :'cust_id', 'a second public booking with the same phone reuses the existing customer, not a duplicate');

-- Double-booking the exact same slot must still be rejected by the
-- exclusion constraint — a public caller gets no special treatment.
select test.act_as_anon();

select test.assert_denied(
  format(
    $sql$select public.create_public_appointment(%L, %L, %L, current_date + 3, '09:00', 'Outro Cliente', '19977776666')$sql$,
    :'a_slug', :'service_a_id', :'professional_a_id'
  ),
  'a second public booking for the exact same (professional, time) slot is rejected (appointments_no_overlap_per_professional)'
);

-- ---------------------------------------------------------------------
-- 5. Isolation: none of the above ever touched company B.
-- ---------------------------------------------------------------------
select test.act_as_superuser();

select count(*) as n from public.appointments
where company_id = :'company_b_id'::uuid and created_by is null \gset bpub_
select test.assert_row_count(0, :bpub_n, 'no public booking ever landed on company B');

select test.assert(true, 'public self-service booking: read scope, write scope, cross-company tampering and double-booking all verified');
