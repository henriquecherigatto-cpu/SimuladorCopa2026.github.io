-- Table/function-level GRANTs for the `authenticated` role.
--
-- These grants only control whether the role may attempt a statement
-- at all — Row Level Security (already enabled on every table above)
-- is what actually decides which rows are visible or writable. A
-- GRANT without RLS would be wide open; RLS without a GRANT would
-- reject every statement before policies are even evaluated. Both
-- layers are required.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.companies,
  public.company_members,
  public.professionals,
  public.services,
  public.professional_services,
  public.business_hours,
  public.time_blocks,
  public.customers,
  public.appointments,
  public.plans,
  public.subscriptions,
  public.billing_events,
  public.audit_logs
to authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.user_company_ids() to authenticated;
grant execute on function public.has_company_role(uuid, public.company_member_role[]) to authenticated;
grant execute on function public.professional_id_for_current_user(uuid) to authenticated;
grant execute on function public.admin_company_overview() to authenticated;
grant execute on function public.admin_platform_metrics() to authenticated;

-- billing_events and subscriptions are only ever written by
-- service_role (webhook handler) or by public.create_company_with_owner
-- (which is SECURITY DEFINER and so does not need these grants
-- itself) — the table-level INSERT/UPDATE grant to `authenticated`
-- above is intentionally still blocked at the row level because
-- those two tables have no insert/update RLS policy for authenticated
-- beyond "is_platform_admin()". This keeps the grant list uniform and
-- lets RLS be the single place that encodes who can actually write.
