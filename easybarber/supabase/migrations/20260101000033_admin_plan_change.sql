-- Lets the platform admin move a company between plans directly from
-- the admin panel (e.g. Essencial -> Profissional), instead of that
-- only ever happening through the barbershop's own checkout. Two
-- parts: admin_company_overview() needs to expose plan_id (today it
-- only has the plan's name/price, nothing to target an update with),
-- and a new RPC does the actual update + audit log in one atomic call
-- — the same "write + write_audit_log() together" shape as
-- admin_update_plan_price() in 20260101000023_admin_analytics.sql,
-- since a plan_id change on subscriptions doesn't trip
-- audit_subscription_change() (that trigger only watches `status`,
-- see 20260101000008_audit_logs.sql).

-- admin_company_overview() changes its return column list (adds
-- plan_id right after company_name), so — same as every such change in
-- this schema — it's a drop + create, not a plain replace.
drop function if exists public.admin_company_overview();

create function public.admin_company_overview()
returns table (
  company_id uuid,
  company_name text,
  plan_id uuid,
  plan_name text,
  plan_price_cents int,
  subscription_status public.subscription_status,
  professional_count bigint,
  customer_count bigint,
  next_payment_date date,
  appointment_count bigint,
  appointments_this_month bigint,
  whatsapp_message_count bigint,
  whatsapp_messages_this_month bigint,
  whatsapp_cost_cents bigint
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
    s.plan_id,
    p.name,
    p.price_cents,
    s.status,
    (select count(*) from public.professionals pr where pr.company_id = c.id and pr.active),
    (select count(*) from public.customers cu where cu.company_id = c.id),
    s.current_period_end,
    (select count(*) from public.appointments a where a.company_id = c.id),
    (select count(*) from public.appointments a
       where a.company_id = c.id
         and date_trunc('month', a.starts_at at time zone public.app_timezone())
           = date_trunc('month', now() at time zone public.app_timezone())),
    (select count(*) from public.whatsapp_messages w where w.company_id = c.id),
    (select count(*) from public.whatsapp_messages w
       where w.company_id = c.id
         and date_trunc('month', w.created_at at time zone public.app_timezone())
           = date_trunc('month', now() at time zone public.app_timezone())),
    (select coalesce(sum(w.cost_cents), 0) from public.whatsapp_messages w where w.company_id = c.id)
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  order by c.created_at desc;
end;
$$;

comment on function public.admin_company_overview is
  'Admin-only aggregated company list (counts, not raw rows) for the platform admin panel. plan_id added so the admin panel can target a plan change.';

revoke all on function public.admin_company_overview() from public;
grant execute on function public.admin_company_overview() to authenticated;

-- ---------------------------------------------------------------------
-- admin_update_company_plan: moves a company to a different (active)
-- plan and writes the audit entry atomically. Deliberately does not
-- touch current_period_end/status — a plan change is a change of
-- price/limits going forward, not a payment event, so it leaves the
-- subscription's billing cycle exactly where it was.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_company_plan(p_company_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_plan_name text;
  v_new_plan_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_update_company_plan().'
      using errcode = '42501';
  end if;

  select name into v_new_plan_name from public.plans where id = p_plan_id and active;
  if v_new_plan_name is null then
    raise exception 'Plan not found or inactive.' using errcode = 'P0002';
  end if;

  select p.name into v_old_plan_name
  from public.subscriptions s
  left join public.plans p on p.id = s.plan_id
  where s.company_id = p_company_id;

  if not found then
    raise exception 'Subscription not found for this company.' using errcode = 'P0002';
  end if;

  update public.subscriptions set plan_id = p_plan_id where company_id = p_company_id;

  perform public.write_audit_log(
    p_company_id, 'company_plan_changed', 'subscription', p_company_id,
    jsonb_build_object('from_plan', v_old_plan_name, 'to_plan', v_new_plan_name)
  );
end;
$$;

comment on function public.admin_update_company_plan is
  'Admin-only: moves a company to a different plan and writes the audit log entry atomically.';

revoke all on function public.admin_update_company_plan(uuid, uuid) from public;
grant execute on function public.admin_update_company_plan(uuid, uuid) to authenticated;
