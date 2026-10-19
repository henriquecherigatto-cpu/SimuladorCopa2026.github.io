-- Payment moves out of the mandatory signup sequence (companion app
-- change: the 'pendente' redirect in (app)/layout.tsx and every
-- onboarding step page is removed, and new signups land straight on
-- /onboarding/horarios) — a barbershop can now set up horários,
-- serviços, profissionais and everything else while still 'pendente',
-- reaching /plano on its own to activate whenever it chooses. The
-- data-layer block this app already relies on for a lapsed
-- subscription (20260101000025_admin_subscription_control.sql) is the
-- one place left that can still guarantee no REAL booking happens
-- before the first payment clears — the app-level gate that used to
-- do that job is gone. Extends it to also cover pendente, exactly the
-- same way it already covers suspensa: no new appointment, neither
-- the owner's own nor a customer's via the public booking link, until
-- the subscription is actually active. tolerancia (an existing,
-- once-paying subscription's grace period) is untouched — it still
-- takes bookings, same as before.

create or replace function public.check_company_subscription_active()
returns trigger
language plpgsql
as $$
declare
  v_status public.subscription_status;
begin
  select status into v_status
  from public.subscriptions
  where company_id = new.company_id;

  if v_status = 'suspensa' then
    raise exception 'Esta barbearia está com o acesso suspenso por falta de pagamento. Novos agendamentos ficam bloqueados até a reativação.'
      using errcode = 'P0001';
  elsif v_status = 'pendente' then
    raise exception 'Esta barbearia ainda não ativou a assinatura. Novos agendamentos ficam disponíveis assim que o primeiro pagamento for confirmado.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.check_company_subscription_active is
  'Blocks new appointment rows for a suspended OR never-activated (pendente) subscription. Fires only on INSERT, so an existing appointment stays fully manageable while blocked — only creating a NEW one is. Covers both createAppointment() and create_public_appointment() via the single appointments_require_active_subscription trigger.';
