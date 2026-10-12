-- When a company is deleted, the DELETE cascades into company_members
-- (ON DELETE CASCADE), whose AFTER DELETE trigger writes a
-- 'member_removed' audit_logs row referencing that same company_id —
-- but at that point, mid-cascade, the companies row is already gone
-- and the immediate foreign-key check on audit_logs.company_id fails.
-- Deferring the check to transaction commit (by which point the
-- whole cascade has finished and audit_logs.company_id is allowed to
-- dangle, same as any other row referencing a deleted company) fixes
-- this without changing any application behaviour.
alter table public.audit_logs
  drop constraint audit_logs_company_id_fkey,
  add constraint audit_logs_company_id_fkey
    foreign key (company_id) references public.companies (id) on delete cascade
    deferrable initially deferred;
