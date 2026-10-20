-- Payment moves from the automated Asaas checkout to a manually-
-- controlled Pix: the platform admin sets one fixed QR code image +
-- Pix key (not per-company — there's exactly one person receiving
-- these payments), every barbershop sees the same QR/key on /plano,
-- pays outside the app via their own Pix app, and the admin confirms
-- receipt themselves and activates access the same way manual
-- confirmation already worked before any automation existed:
-- admin_grant_subscription_access() ("Liberar acesso"), already built
-- in 20260101000025_admin_subscription_control.sql with exactly this
-- scenario in mind (its own doc comment already says "Pix/WhatsApp,
-- while real checkout isn't live"). Nothing about Asaas is removed by
-- this migration — createCheckoutSession/the webhook/billing_events
-- all stay intact and working, just unused by the current /plano UI,
-- so this is reversible without another migration if automated
-- checkout ever comes back.

-- ---------------------------------------------------------------------
-- 1. Singleton settings row. id is always 1 — enforced by the check
-- constraint rather than relying on callers to never insert a second
-- row. Seeded once below so admin_update_pix_settings() can always
-- UPDATE a known row instead of needing upsert logic.
-- ---------------------------------------------------------------------
create table public.pix_payment_settings (
  id int primary key default 1 check (id = 1),
  pix_key text,
  qr_code_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.pix_payment_settings is
  'Single-row, platform-wide Pix receiving details (one admin-controlled QR code + key, shown to every company on /plano). Never written directly — only through admin_update_pix_settings().';

insert into public.pix_payment_settings (id) values (1);

alter table public.pix_payment_settings enable row level security;

-- Every signed-in user needs to read this on /plano, company owner or
-- not — it's the same QR/key for everyone. No insert/update/delete
-- policy at all: the only way to write is the security-definer RPC
-- below, which bypasses RLS on its own authority after checking
-- is_platform_admin() itself, same reasoning as every other admin_*
-- write in this schema.
create policy pix_payment_settings_read
  on public.pix_payment_settings for select
  to authenticated
  using (true);

-- RLS alone isn't enough — same two-layer reasoning as
-- 20260101000014_grants.sql: a GRANT without RLS would be wide open,
-- but RLS without a GRANT rejects the statement before any policy
-- even runs. No insert/update/delete grant: writes only ever go
-- through admin_update_pix_settings(), a security-definer function
-- that doesn't need one.
grant select on public.pix_payment_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. Admin-only write, audited — same shape as admin_update_plan_price().
-- ---------------------------------------------------------------------
create or replace function public.admin_update_pix_settings(p_pix_key text, p_qr_code_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can call admin_update_pix_settings().'
      using errcode = '42501';
  end if;

  update public.pix_payment_settings
  set pix_key = nullif(btrim(coalesce(p_pix_key, '')), ''),
      qr_code_url = nullif(btrim(coalesce(p_qr_code_url, '')), ''),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.write_audit_log(
    null, 'pix_settings_updated', 'pix_payment_settings', null,
    jsonb_build_object(
      'pix_key', nullif(btrim(coalesce(p_pix_key, '')), ''),
      'qr_code_changed', p_qr_code_url is not null
    )
  );
end;
$$;

comment on function public.admin_update_pix_settings is
  'Admin-only: replaces the platform''s Pix key and/or QR code URL and writes the audit log entry atomically. Pass the existing qr_code_url back unchanged when only the key is being updated — this always overwrites both fields, it does not merge.';

revoke all on function public.admin_update_pix_settings(text, text) from public;
grant execute on function public.admin_update_pix_settings(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Storage bucket for the QR code image. Same guarded-migration
-- shape as professional-photos (20260101000021_photos_whatsapp_cancellation.sql)
-- for the same reason: the SQL test harness's throwaway Postgres
-- container has no Supabase Storage at all. Flat bucket, no per-company
-- folder scoping (there's nothing per-company about it) — writes are
-- gated on is_platform_admin() directly instead.
-- ---------------------------------------------------------------------
do $migration$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $sql$
      insert into storage.buckets (id, name, public)
      values ('pix-qr-code', 'pix-qr-code', true)
      on conflict (id) do nothing
    $sql$;

    execute $sql$
      create policy pix_qr_code_public_read
        on storage.objects for select
        using (bucket_id = 'pix-qr-code')
    $sql$;

    execute $sql$
      create policy pix_qr_code_admin_insert
        on storage.objects for insert
        to authenticated
        with check (bucket_id = 'pix-qr-code' and public.is_platform_admin())
    $sql$;

    execute $sql$
      create policy pix_qr_code_admin_update
        on storage.objects for update
        to authenticated
        using (bucket_id = 'pix-qr-code' and public.is_platform_admin())
        with check (bucket_id = 'pix-qr-code' and public.is_platform_admin())
    $sql$;

    execute $sql$
      create policy pix_qr_code_admin_delete
        on storage.objects for delete
        to authenticated
        using (bucket_id = 'pix-qr-code' and public.is_platform_admin())
    $sql$;
  end if;
end;
$migration$;
