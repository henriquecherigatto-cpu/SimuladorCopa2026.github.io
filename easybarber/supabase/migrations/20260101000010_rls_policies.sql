-- Row Level Security policies.
--
-- Design rules followed throughout this file:
--   1. Every tenant-scoped table is filtered through
--      public.user_company_ids() / public.has_company_role(), which
--      derive the caller's companies from public.company_members —
--      never from a company_id the client sent.
--   2. The platform admin (public.is_platform_admin()) is granted
--      direct row access ONLY to platform-operational tables:
--      companies, company_members, profiles, plans, subscriptions,
--      billing_events, audit_logs. Admin is deliberately NOT given a
--      bypass on professionals, services, business_hours, time_blocks,
--      customers or appointments — per the brief, the admin must not
--      have unrestricted access to a barbershop's end-customer data
--      without a legitimate operational need. Aggregated counts for
--      the admin dashboard come from admin_company_overview()
--      (see 20260101000011_admin_overview.sql), not row access.
--   3. Tables that must only ever be written by trusted server-side
--      code (subscriptions, billing_events, audit_logs, profiles
--      creation) get NO insert/update policy for the authenticated
--      role at all, so direct client writes are denied by default —
--      only the service_role key (which bypasses RLS) or a
--      SECURITY DEFINER function can write them.

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.profile_id = auth.uid()
        and theirs.profile_id = profiles.id
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

-- Belt-and-braces on top of the policy above: even an admin flips
-- is_platform_admin only as an explicit, already-privileged action,
-- and a non-admin can never flip their own flag, regardless of how
-- the UPDATE statement is shaped.
create or replace function public.prevent_self_admin_escalation()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() is null for anything that isn't an authenticated
  -- client request (a direct migration, a service-role script, the
  -- very first admin being seeded by whoever has raw database
  -- access) — that path is trusted by definition, since it requires
  -- real database credentials rather than just a client-side call.
  -- What this trigger exists to stop is an authenticated client
  -- (auth.uid() is not null) who isn't already an admin flipping the
  -- flag on themselves or anyone else.
  if auth.uid() is not null
     and new.is_platform_admin is distinct from old.is_platform_admin
     and not public.is_platform_admin() then
    raise exception 'Only an existing platform admin can change is_platform_admin.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_admin_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_admin_escalation();

-- No insert/delete policy: rows are created by the
-- handle_new_auth_user trigger (SECURITY DEFINER) and deleted only by
-- cascading from auth.users.

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
alter table public.companies enable row level security;

create policy companies_select on public.companies
  for select to authenticated
  using (id in (select public.user_company_ids()) or public.is_platform_admin());

create policy companies_update on public.companies
  for update to authenticated
  using (public.has_company_role(id, array['owner']::public.company_member_role[]) or public.is_platform_admin())
  with check (public.has_company_role(id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_platform_admin());

-- No insert policy: companies are created exclusively through
-- public.create_company_with_owner(), which runs as SECURITY DEFINER
-- so the company row and its first owner membership are created in
-- one transaction — a company can never end up without a valid owner.

-- ---------------------------------------------------------------------
-- company_members
-- ---------------------------------------------------------------------
alter table public.company_members enable row level security;

create policy company_members_select on public.company_members
  for select to authenticated
  using (company_id in (select public.user_company_ids()) or public.is_platform_admin());

create policy company_members_insert on public.company_members
  for insert to authenticated
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

create policy company_members_update on public.company_members
  for update to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin())
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

create policy company_members_delete on public.company_members
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

-- ---------------------------------------------------------------------
-- professionals / services / professional_services
-- (company members read, owner writes, NO admin bypass)
-- ---------------------------------------------------------------------
alter table public.professionals enable row level security;

create policy professionals_select on public.professionals
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy professionals_write on public.professionals
  for all to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

alter table public.services enable row level security;

create policy services_select on public.services
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy services_write on public.services
  for all to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

alter table public.professional_services enable row level security;

create policy professional_services_select on public.professional_services
  for select to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and p.company_id in (select public.user_company_ids())
    )
  );

create policy professional_services_write on public.professional_services
  for all to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id
        and public.has_company_role(p.company_id, array['owner']::public.company_member_role[])
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id
        and public.has_company_role(p.company_id, array['owner']::public.company_member_role[])
    )
  );

-- ---------------------------------------------------------------------
-- business_hours / time_blocks (company members read, owner writes)
-- ---------------------------------------------------------------------
alter table public.business_hours enable row level security;

create policy business_hours_select on public.business_hours
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy business_hours_write on public.business_hours
  for all to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

alter table public.time_blocks enable row level security;

create policy time_blocks_select on public.time_blocks
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy time_blocks_write on public.time_blocks
  for all to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

-- ---------------------------------------------------------------------
-- customers (owner + professional read/write, only owner deletes,
-- NO admin bypass — this is end-customer personal data)
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_company_role(company_id, array['owner', 'professional']::public.company_member_role[]));

create policy customers_update on public.customers
  for update to authenticated
  using (public.has_company_role(company_id, array['owner', 'professional']::public.company_member_role[]))
  with check (public.has_company_role(company_id, array['owner', 'professional']::public.company_member_role[]));

create policy customers_delete on public.customers
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]));

-- ---------------------------------------------------------------------
-- appointments (owner sees/edits everything in their company; a
-- professional sees and edits only their OWN appointments; NO admin
-- bypass; deletes are disallowed — cancel via status instead)
-- ---------------------------------------------------------------------
alter table public.appointments enable row level security;

create policy appointments_select on public.appointments
  for select to authenticated
  using (
    public.has_company_role(company_id, array['owner']::public.company_member_role[])
    or (
      public.has_company_role(company_id, array['professional']::public.company_member_role[])
      and professional_id = public.professional_id_for_current_user(company_id)
    )
  );

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (public.has_company_role(company_id, array['owner', 'professional']::public.company_member_role[]));

create policy appointments_update on public.appointments
  for update to authenticated
  using (
    public.has_company_role(company_id, array['owner']::public.company_member_role[])
    or (
      public.has_company_role(company_id, array['professional']::public.company_member_role[])
      and professional_id = public.professional_id_for_current_user(company_id)
    )
  )
  with check (
    public.has_company_role(company_id, array['owner']::public.company_member_role[])
    or (
      public.has_company_role(company_id, array['professional']::public.company_member_role[])
      and professional_id = public.professional_id_for_current_user(company_id)
    )
  );

-- A professional (not also an owner) may only change status/notes on
-- their own appointment — not reassign it, change the customer, the
-- service or the time. The RLS policy above already restricts *which
-- rows* a plain professional can touch; this trigger restricts *which
-- columns* on those rows.
create or replace function public.restrict_professional_appointment_updates()
returns trigger
language plpgsql
as $$
begin
  if public.has_company_role(new.company_id, array['owner']::public.company_member_role[]) then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.professional_id is distinct from old.professional_id
     or new.service_id is distinct from old.service_id
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.company_id is distinct from old.company_id then
    raise exception 'A professional may only update the status and notes of their own appointment.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger appointments_restrict_professional_updates
  before update on public.appointments
  for each row execute function public.restrict_professional_appointment_updates();

-- ---------------------------------------------------------------------
-- plans (public catalogue to any authenticated user; admin manages it)
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;

create policy plans_select on public.plans
  for select to authenticated
  using (active or public.is_platform_admin());

create policy plans_write on public.plans
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- subscriptions (company owner reads their own; ONLY the admin / the
-- service-role billing webhook can change subscription status — a
-- company can never grant itself access by writing its own row)
-- ---------------------------------------------------------------------
alter table public.subscriptions enable row level security;

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- billing_events (company owner reads their own; nobody writes from
-- the client — only the service role, from the verified webhook
-- handler, which bypasses RLS entirely)
-- ---------------------------------------------------------------------
alter table public.billing_events enable row level security;

create policy billing_events_select on public.billing_events
  for select to authenticated
  using (public.has_company_role(company_id, array['owner']::public.company_member_role[]) or public.is_platform_admin());

-- ---------------------------------------------------------------------
-- audit_logs (append-only; admin sees everything, an owner sees only
-- their own company's entries; nobody can insert/update/delete
-- directly — only public.write_audit_log(), SECURITY DEFINER)
-- ---------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.is_platform_admin()
    or (company_id is not null and public.has_company_role(company_id, array['owner']::public.company_member_role[]))
  );
