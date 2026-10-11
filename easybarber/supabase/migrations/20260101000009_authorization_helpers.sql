-- Authorization helper functions used throughout the RLS policies.
--
-- All three are SECURITY DEFINER, owned by the migration role (not a
-- client-controllable role), so they can read public.company_members
-- without being subject to that table's own RLS policy — which is
-- what would otherwise cause infinite recursion (company_members' RLS
-- policy itself calls these helpers). Each one has a fixed,
-- minimal search_path to avoid search_path hijacking, and each is
-- narrowly scoped: they only ever return a boolean or a set of ids
-- derived from auth.uid(), never arbitrary rows.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_platform_admin is
  'True if the currently authenticated user is a platform administrator. Never settable by the user themselves — see profiles RLS policy.';

create or replace function public.user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.company_members
  where profile_id = auth.uid();
$$;

comment on function public.user_company_ids is
  'Companies the current user belongs to (any role). The single source every tenant-scoped RLS policy filters on.';

create or replace function public.has_company_role(p_company_id uuid, p_roles public.company_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and profile_id = auth.uid()
      and role = any (p_roles)
  );
$$;

comment on function public.has_company_role is
  'True if the current user belongs to the given company with one of the given roles.';

create or replace function public.professional_id_for_current_user(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.professionals
  where company_id = p_company_id
    and profile_id = auth.uid()
  limit 1;
$$;

comment on function public.professional_id_for_current_user is
  'The professionals.id row (if any) linking the current user to the given company, used to let a professional manage only their own appointments.';
