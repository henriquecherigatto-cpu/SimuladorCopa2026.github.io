-- Enables Supabase Realtime (Postgres change events over websocket) for
-- the appointments table, so the owner's Agenda screen can refresh the
-- moment a booking is created/changed/cancelled, instead of only on a
-- manual page reload.
--
-- Realtime's Postgres Changes feature evaluates the table's own RLS
-- policies per connected client, using that client's JWT — so an
-- owner's browser only ever receives events for rows appointments_select
-- (20260101000010_rls_policies.sql) already lets them read: their own
-- company, or for a "professional" role, only their own appointments.
-- No new data exposure beyond what the existing policy already grants.
--
-- REPLICA IDENTITY FULL is required for UPDATE/DELETE events: the
-- default replica identity only includes the primary key in the change
-- payload, which isn't enough for Realtime to evaluate the RLS
-- condition (it needs company_id/professional_id on the row).
alter table public.appointments replica identity full;

alter publication supabase_realtime add table public.appointments;
