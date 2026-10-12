-- Fixture data for the isolation tests: two unrelated companies
-- ("Barber 013" and "Navalha Club"), each with their own owner,
-- professional, customer and appointment — created through the real
-- app-level paths (the create_company_with_owner RPC, then normal
-- owner-role inserts), not by poking rows in directly, so these tests
-- exercise the exact same path the product uses.
--
-- This file is \i-included from run_all.sql, which runs as a single
-- psql session so every \gset variable below stays available to the
-- test files included after it.
select test.act_as_superuser();

begin;

insert into auth.users (email) values ('owner-a@example.com') returning id as owner_a_id \gset
insert into auth.users (email) values ('prof-a@example.com') returning id as prof_a_user_id \gset
insert into auth.users (email) values ('prof-a2@example.com') returning id as prof_a2_user_id \gset
insert into auth.users (email) values ('owner-b@example.com') returning id as owner_b_id \gset
insert into auth.users (email) values ('prof-b@example.com') returning id as prof_b_user_id \gset
insert into auth.users (email) values ('nobody@example.com') returning id as outsider_id \gset

select test.act_as(:'owner_a_id'::uuid);
select public.create_company_with_owner('Barber 013', '19999990001', null, 'Rua A, 1') as company_a_id \gset

select test.act_as(:'owner_b_id'::uuid);
select public.create_company_with_owner('Navalha Club', '19999990002', null, 'Rua B, 2') as company_b_id \gset

-- Owner A builds out their company.
select test.act_as(:'owner_a_id'::uuid);

insert into public.company_members (company_id, profile_id, role)
values (:'company_a_id'::uuid, :'prof_a_user_id'::uuid, 'professional');

insert into public.professionals (company_id, profile_id, name, phone)
values (:'company_a_id'::uuid, :'prof_a_user_id'::uuid, 'Carlos (A)', '19999990003')
returning id as professional_a_id \gset

insert into public.services (company_id, name, duration_min, price_cents)
values (:'company_a_id'::uuid, 'Corte de cabelo', 45, 3000)
returning id as service_a_id \gset

insert into public.professional_services (professional_id, service_id)
values (:'professional_a_id'::uuid, :'service_a_id'::uuid);

insert into public.customers (company_id, name, phone)
values (:'company_a_id'::uuid, 'Cliente A', '19999990004')
returning id as customer_a_id \gset

insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a_id'::uuid, :'service_a_id'::uuid,
  (current_date + 1 + interval '10 hour'), (current_date + 1 + interval '10 hour 45 minute'),
  :'owner_a_id'::uuid
)
returning id as appointment_a_id \gset

-- A second professional in company A (same company as professional_a,
-- but a distinct teammate) — used to prove a professional cannot see
-- or edit a *teammate's* appointment either, not just another
-- company's.
insert into public.company_members (company_id, profile_id, role)
values (:'company_a_id'::uuid, :'prof_a2_user_id'::uuid, 'professional');

insert into public.professionals (company_id, profile_id, name, phone)
values (:'company_a_id'::uuid, :'prof_a2_user_id'::uuid, 'João (A2)', '19999990007')
returning id as professional_a2_id \gset

insert into public.professional_services (professional_id, service_id)
values (:'professional_a2_id'::uuid, :'service_a_id'::uuid);

insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_a_id'::uuid, :'customer_a_id'::uuid, :'professional_a2_id'::uuid, :'service_a_id'::uuid,
  (current_date + 1 + interval '14 hour'), (current_date + 1 + interval '14 hour 45 minute'),
  :'owner_a_id'::uuid
)
returning id as appointment_a2_id \gset

-- Owner B builds out their (unrelated) company.
select test.act_as(:'owner_b_id'::uuid);

insert into public.company_members (company_id, profile_id, role)
values (:'company_b_id'::uuid, :'prof_b_user_id'::uuid, 'professional');

insert into public.professionals (company_id, profile_id, name, phone)
values (:'company_b_id'::uuid, :'prof_b_user_id'::uuid, 'Matheus (B)', '19999990005')
returning id as professional_b_id \gset

insert into public.services (company_id, name, duration_min, price_cents)
values (:'company_b_id'::uuid, 'Barba', 30, 2500)
returning id as service_b_id \gset

insert into public.professional_services (professional_id, service_id)
values (:'professional_b_id'::uuid, :'service_b_id'::uuid);

insert into public.customers (company_id, name, phone)
values (:'company_b_id'::uuid, 'Cliente B', '19999990006')
returning id as customer_b_id \gset

insert into public.appointments (company_id, customer_id, professional_id, service_id, starts_at, ends_at, created_by)
values (
  :'company_b_id'::uuid, :'customer_b_id'::uuid, :'professional_b_id'::uuid, :'service_b_id'::uuid,
  (current_date + 1 + interval '11 hour'), (current_date + 1 + interval '11 hour 30 minute'),
  :'owner_b_id'::uuid
)
returning id as appointment_b_id \gset

-- A platform admin. In production this flag is only ever flipped by
-- an existing admin (or directly via service_role/SQL for the very
-- first one) — never by the user themselves. We do that here as the
-- superuser, outside of any client-facing RLS path.
select test.act_as_superuser();
update public.profiles set is_platform_admin = true where id = :'outsider_id'::uuid;

commit;

select test.act_as_superuser();

select test.assert(true, 'fixtures created: two independent companies with owner, professional, customer, appointment each');
