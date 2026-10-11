-- audit_logs: append-only trail of sensitive actions. company_id is
-- null for platform-level actions (e.g. a platform admin editing a
-- plan). Rows are written by triggers / SECURITY DEFINER functions,
-- never directly by client inserts (see RLS policies), so the log
-- can't be forged by a compromised client.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id),
  company_id uuid references public.companies (id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. Only written by triggers/SECURITY DEFINER functions. company_id null = platform-level action.';

create index audit_logs_company_id_idx on public.audit_logs (company_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.write_audit_log(
  p_company_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_profile_id, company_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_company_id, p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

comment on function public.write_audit_log is
  'SECURITY DEFINER helper so triggers can log regardless of the caller''s own audit_logs permissions (clients have none).';

-- Auto-log subscription status changes and company_members role/owner
-- changes — the two kinds of event most worth an audit trail.
create or replace function public.audit_subscription_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.write_audit_log(
      new.company_id,
      'subscription_status_changed',
      'subscription',
      new.id,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger subscriptions_audit_status_change
  after update on public.subscriptions
  for each row execute function public.audit_subscription_change();

create or replace function public.audit_company_member_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      new.company_id, 'member_added', 'company_member', new.id,
      jsonb_build_object('profile_id', new.profile_id, 'role', new.role)
    );
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.write_audit_log(
      new.company_id, 'member_role_changed', 'company_member', new.id,
      jsonb_build_object('profile_id', new.profile_id, 'from', old.role, 'to', new.role)
    );
  elsif tg_op = 'DELETE' then
    perform public.write_audit_log(
      old.company_id, 'member_removed', 'company_member', old.id,
      jsonb_build_object('profile_id', old.profile_id, 'role', old.role)
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger company_members_audit
  after insert or update or delete on public.company_members
  for each row execute function public.audit_company_member_change();
