-- Adds the company's own identity/contact fields (phone, address,
-- CNPJ, booking-link slug, signup date, owner email) to
-- admin_company_overview() — needed for the admin panel's new
-- "Exportar Excel" button, which needs the full company record, not
-- just the aggregated stats the on-screen cards show. The counts and
-- plan/subscription columns are unchanged.
--
-- owner_email comes from profiles (the barbershop owner's own
-- account), not from any end-customer table — the function's
-- existing "never a customer name, an appointment's time, or a
-- message's contents" rule is about the barbershop's OWN customers,
-- not about the business's own contact info, which a platform admin
-- legitimately needs to reach the business itself.
--
-- Changes the return column list, so — same as every such change in
-- this schema — it's a drop + create, not a plain replace.
drop function if exists public.admin_company_overview();

create function public.admin_company_overview()
returns table (
  company_id uuid,
  company_name text,
  company_phone text,
  company_address text,
  company_cnpj text,
  company_slug text,
  company_created_at timestamptz,
  owner_email text,
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
    c.phone,
    c.address,
    c.cnpj,
    c.slug,
    c.created_at,
    owner.email,
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
  left join public.profiles owner on owner.id = c.created_by
  order by c.created_at desc;
end;
$$;

comment on function public.admin_company_overview is
  'Admin-only aggregated company list (counts, not raw rows) for the platform admin panel, plus the company''s own contact/identity fields (phone, address, CNPJ, booking slug, signup date, owner email) for the full-export button. plan_id added so the admin panel can target a plan change.';

revoke all on function public.admin_company_overview() from public;
grant execute on function public.admin_company_overview() to authenticated;
