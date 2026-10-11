-- company_members: who can access which company, and with what role.
-- This is the join table every RLS policy below ultimately trusts —
-- never the company_id a client happens to send.
create type public.company_member_role as enum ('owner', 'professional');

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.company_member_role not null,
  created_at timestamptz not null default now(),
  unique (company_id, profile_id)
);

comment on table public.company_members is
  'Membership + role of a profile within a company. The single source of truth for authorization checks.';

create index company_members_profile_id_idx on public.company_members (profile_id);
create index company_members_company_id_idx on public.company_members (company_id);

-- A company must always keep at least one owner. This protects against
-- an application bug (or a malicious member) leaving a company without
-- anyone able to administer it.
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
as $$
declare
  remaining_owners int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into remaining_owners
    from public.company_members
    where company_id = old.company_id
      and role = 'owner'
      and id <> old.id;

    if remaining_owners = 0 then
      raise exception 'A company must keep at least one owner.'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger company_members_prevent_last_owner_removal
  before update or delete on public.company_members
  for each row execute function public.prevent_last_owner_removal();
