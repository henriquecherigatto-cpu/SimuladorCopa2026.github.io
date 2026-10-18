-- Mandatory sequential onboarding, past the existing payment gate:
-- confirm business hours -> add at least one service -> add at least
-- one professional, in that exact order, before a company gets any
-- access to the main app (src/app/(app)/layout.tsx enforces this).
--
-- onboarding_step: 0 = needs horarios, 1 = needs servicos, 2 = needs
-- profissionais, 3 = fully onboarded. A ONE-TIME gate, deliberately —
-- once a company reaches 3 it is never re-checked again, even if it
-- later has zero services (e.g. the owner is reorganizing its
-- catalog) — this mirrors how the existing subscription gate also
-- never re-blocks a company once it's past 'pendente' (a later
-- 'suspensa'/'tolerancia' only shows a dismissible warning, never a
-- hard redirect back into onboarding).
--
-- default 3 (not 0) is what makes this migration safe for every
-- EXISTING company: ALTER TABLE ... DEFAULT backfills every existing
-- row to 3 (already fully onboarded, nothing changes for them).
-- create_company_with_owner() is the only place a NEW company is
-- created, and it explicitly inserts onboarding_step = 0 below,
-- overriding the table's own default for that one path.
alter table public.companies add column onboarding_step smallint not null default 3;

comment on column public.companies.onboarding_step is
  '0=needs horarios, 1=needs servicos, 2=needs profissionais, 3=fully onboarded (one-time gate, never re-checked once reached). Existing companies backfilled to 3 by this column''s own default; create_company_with_owner() explicitly sets 0 for new signups.';

-- Same signature as before (no arguments added/changed) — a plain
-- CREATE OR REPLACE is safe here, unlike the "drop + create" dance
-- this schema needs whenever a function's argument-type list itself
-- changes.
create or replace function public.create_company_with_owner(
  p_name text,
  p_phone text,
  p_cnpj text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_default_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a company.'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Company name is required.' using errcode = '22023';
  end if;

  if btrim(coalesce(p_phone, '')) = '' then
    raise exception 'Company phone is required.' using errcode = '22023';
  end if;

  insert into public.companies (name, phone, cnpj, address, created_by, slug, onboarding_step)
  values (
    btrim(p_name), btrim(p_phone), nullif(btrim(coalesce(p_cnpj, '')), ''), nullif(btrim(coalesce(p_address, '')), ''),
    auth.uid(), public.generate_company_slug(p_name), 0
  )
  returning id into v_company_id;

  insert into public.company_members (company_id, profile_id, role)
  values (v_company_id, auth.uid(), 'owner');

  insert into public.business_hours (company_id, day_of_week, is_open, start_time, end_time)
  select v_company_id, d, true, '08:00', '18:00'
  from generate_series(0, 6) as d;

  select id into v_default_plan_id
  from public.plans
  where active
  order by price_cents asc
  limit 1;

  if v_default_plan_id is not null then
    insert into public.subscriptions (company_id, plan_id, status, grace_period_days)
    values (v_company_id, v_default_plan_id, 'pendente', 10);
  end if;

  perform public.write_audit_log(
    v_company_id, 'company_created', 'company', v_company_id,
    jsonb_build_object('name', p_name)
  );

  return v_company_id;
end;
$$;

-- ---------------------------------------------------------------------
-- advance_onboarding_step: the only way onboarding_step moves forward.
-- A compare-and-swap (the "where onboarding_step = p_expected_step"
-- clause) rather than a blind increment, so a double-submit (double
-- click, two tabs) can only ever advance once — the second call's
-- UPDATE matches zero rows and returns false, not an error, and not a
-- skipped step. What actually QUALIFIES a step as complete (hours
-- confirmed, >=1 service, >=1 professional) is checked in the calling
-- Server Action (src/lib/actions/onboarding.ts), which runs under the
-- caller's own RLS-scoped session — this function only enforces WHO
-- may advance (the company's own owner) and that steps can't be
-- skipped or replayed out of order.
-- ---------------------------------------------------------------------
create or replace function public.advance_onboarding_step(p_company_id uuid, p_expected_step smallint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_company_role(p_company_id, array['owner']::public.company_member_role[]) then
    raise exception 'Only the company owner can advance onboarding.'
      using errcode = '42501';
  end if;

  update public.companies
  set onboarding_step = p_expected_step + 1
  where id = p_company_id and onboarding_step = p_expected_step;

  return found;
end;
$$;

comment on function public.advance_onboarding_step is
  'Compare-and-swap advance of companies.onboarding_step, owner-only. Returns false (not an error) if p_expected_step no longer matches the current value — a double-submit is a safe no-op, never a skipped or replayed step.';

revoke all on function public.advance_onboarding_step(uuid, smallint) from public;
grant execute on function public.advance_onboarding_step(uuid, smallint) to authenticated;
