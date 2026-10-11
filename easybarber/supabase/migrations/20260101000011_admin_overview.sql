-- Aggregated, admin-only view of the platform. This is how the admin
-- dashboard gets professional/customer counts WITHOUT being granted
-- row-level read access to every company's professionals/customers
-- tables (see the comment at the top of 20260101000010_rls_policies.sql).
-- The function itself checks is_platform_admin() and raises if the
-- caller isn't one, so it is safe to expose even though it is
-- SECURITY DEFINER.
create or replace function public.admin_company_overview()
returns table (
  company_id uuid,
  company_name text,
  plan_name text,
  subscription_status public.subscription_status,
  professional_count bigint,
  customer_count bigint,
  next_payment_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_company_overview().'
      using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    p.name,
    s.status,
    (select count(*) from public.professionals pr where pr.company_id = c.id and pr.active),
    (select count(*) from public.customers cu where cu.company_id = c.id),
    s.current_period_end
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  order by c.created_at desc;
end;
$$;

comment on function public.admin_company_overview is
  'Admin-only aggregated company list (counts, not raw rows) for the platform admin panel.';

create or replace function public.admin_platform_metrics()
returns table (
  total_companies bigint,
  active_companies bigint,
  mrr_cents bigint,
  new_companies_this_month bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_platform_metrics().'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.companies),
    (select count(*) from public.subscriptions where status = 'ativa'),
    (select coalesce(sum(p.price_cents), 0)
       from public.subscriptions s
       join public.plans p on p.id = s.plan_id
       where s.status = 'ativa'),
    (select count(*) from public.companies where date_trunc('month', created_at) = date_trunc('month', now()));
end;
$$;

comment on function public.admin_platform_metrics is
  'Admin-only aggregated platform metrics for the admin dashboard header cards.';
