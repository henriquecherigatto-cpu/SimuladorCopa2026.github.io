-- Adds the Pix "copia e cola" code (the full EMV QR payload string, as
-- text) alongside the existing key + QR image in pix_payment_settings.
-- Pasting this into a banking app's "Pix Copia e Cola" field pre-fills
-- the whole transaction (recipient AND amount) — strictly more useful
-- to the payer than the bare key alone, which only identifies the
-- recipient and still requires typing the amount by hand. The QR
-- image itself already encodes this same string; this column lets
-- /plano offer it as its own one-tap "copy" action too, for whoever's
-- on a device where scanning a QR isn't convenient (no second phone,
-- same-device payment, etc).

alter table public.pix_payment_settings add column copy_paste_code text;

comment on column public.pix_payment_settings.copy_paste_code is
  'The Pix "copia e cola" EMV QR payload, as plain text — pasting it into a banking app pre-fills the whole transaction, recipient and amount alike. Independent of pix_key: either, both, or neither can be set.';

-- Adding a parameter changes the argument-type signature — Postgres
-- identifies a function by name + argument TYPES, so
-- admin_update_pix_settings(text, text) and
-- admin_update_pix_settings(text, text, text) are two different
-- catalog entries, not the same one "replaced". A bare CREATE OR
-- REPLACE here would leave the old 2-arg version callable alongside
-- the new one instead of retiring it. Drop the old signature first,
-- same as create_public_appointment()'s return-type change in
-- 20260101000021_photos_whatsapp_cancellation.sql.
drop function if exists public.admin_update_pix_settings(text, text);

create function public.admin_update_pix_settings(
  p_pix_key text,
  p_qr_code_url text,
  p_copy_paste_code text default null
)
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
      copy_paste_code = nullif(btrim(coalesce(p_copy_paste_code, '')), ''),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.write_audit_log(
    null, 'pix_settings_updated', 'pix_payment_settings', null,
    jsonb_build_object(
      'pix_key', nullif(btrim(coalesce(p_pix_key, '')), ''),
      'qr_code_changed', p_qr_code_url is not null,
      'copy_paste_code_set', nullif(btrim(coalesce(p_copy_paste_code, '')), '') is not null
    )
  );
end;
$$;

comment on function public.admin_update_pix_settings is
  'Admin-only: replaces the platform''s Pix key, QR code URL and/or copia-e-cola code, and writes the audit log entry atomically. Always overwrites all three fields with the given values (nullif-normalized blank -> null) — never merges partial updates, so callers must pass the existing value back unchanged for any field they are not actually changing.';

revoke all on function public.admin_update_pix_settings(text, text, text) from public;
grant execute on function public.admin_update_pix_settings(text, text, text) to authenticated;
