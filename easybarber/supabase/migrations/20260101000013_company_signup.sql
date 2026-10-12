-- The only way to create a company. Runs as a single transaction (a
-- Postgres function body is atomic) so it is impossible to end up with
-- a company row that has no owner, or an owner profile with no
-- company: the company, the owner membership and the starter
-- subscription are all inserted together, or none are.
--
-- SECURITY DEFINER is required because there is deliberately no INSERT
-- policy on public.companies for regular clients (see
-- 20260101000010_rls_policies.sql) — this function is the sanctioned
-- bypass, and it only ever acts on behalf of auth.uid(), never an
-- id supplied by the caller.
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

  insert into public.companies (name, phone, cnpj, address, created_by)
  values (btrim(p_name), btrim(p_phone), nullif(btrim(coalesce(p_cnpj, '')), ''), nullif(btrim(coalesce(p_address, '')), ''), auth.uid())
  returning id into v_company_id;

  insert into public.company_members (company_id, profile_id, role)
  values (v_company_id, auth.uid(), 'owner');

  -- Every weekday defaults to open 08:00–18:00; the owner can change
  -- this later in Configurações > Horário de funcionamento.
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

comment on function public.create_company_with_owner is
  'Transactional signup: creates the company, its owner membership, default business hours and starter subscription together. The only sanctioned way to create a company.';

-- Any authenticated user may call it (it only ever acts as auth.uid()).
grant execute on function public.create_company_with_owner(text, text, text, text) to authenticated;
