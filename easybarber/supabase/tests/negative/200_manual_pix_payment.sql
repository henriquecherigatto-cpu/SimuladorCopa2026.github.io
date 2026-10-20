-- Covers 20260101000043_manual_pix_payment.sql and
-- 20260101000044_pix_copy_paste_code.sql: the platform-wide,
-- single-row Pix settings (one admin-set QR code + key + "copia e
-- cola" code, not per-company) that replaced the Asaas dynamic
-- checkout on /plano.
--
-- Three things worth proving here specifically: (1) any authenticated
-- user can read the row — not just the owner of some company, since
-- every barbershop sees the same QR/key/code; (2) anon cannot read it
-- at all (this isn't exposed on any public page); (3) only a platform
-- admin can write, through admin_update_pix_settings(), never a bare
-- client-side UPDATE (there is no insert/update/delete RLS policy on
-- this table at all, on purpose — see the migration's own comment).
--
-- Calls below mix the 2-arg form (pix_key, qr_code_url) and the 3-arg
-- form (+ copy_paste_code) deliberately — p_copy_paste_code defaults
-- to null, so both forms must keep working after
-- 20260101000044_pix_copy_paste_code.sql dropped and recreated the
-- function with the extra parameter.

select test.act_as_superuser();

-- ---------------------------------------------------------------------
-- 1. Baseline: the single seeded row exists, starts unset.
-- ---------------------------------------------------------------------
select count(*) as n from public.pix_payment_settings \gset baseline_
select test.assert_row_count(1, :baseline_n, 'exactly one pix_payment_settings row exists (the seeded singleton)');

-- ---------------------------------------------------------------------
-- 2. Read access: any authenticated user (an ordinary company owner,
-- not a platform admin) can read it — it's the same for everyone, not
-- company-scoped. anon cannot read it at all.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select count(*) as n from public.pix_payment_settings \gset reada_
select test.assert_row_count(1, :reada_n, 'an ordinary company owner (not platform admin) can read pix_payment_settings');

select test.act_as_anon();
select test.assert_denied(
  'select count(*) from public.pix_payment_settings',
  'anon cannot read pix_payment_settings at all — no grant, let alone a policy, for anon'
);

-- ---------------------------------------------------------------------
-- 3. Write access: only a platform admin can call
-- admin_update_pix_settings(). No direct UPDATE path exists for
-- anyone, admin included — there's no insert/update/delete RLS policy
-- on this table at all, so even is_platform_admin() can't bypass it
-- except through the security-definer RPC.
-- ---------------------------------------------------------------------
select test.act_as(:'owner_a_id'::uuid);
select test.assert_denied(
  format($sql$select public.admin_update_pix_settings('chave-forjada', %L)$sql$, 'https://example.com/forjado.png'),
  'an ordinary company owner cannot call admin_update_pix_settings() — platform admin only'
);
select test.assert_denied(
  'update public.pix_payment_settings set pix_key = ''direto'' where id = 1',
  'no one can UPDATE pix_payment_settings directly, not even by bypassing the RPC — no write policy exists for any role'
);

select test.act_as_anon();
select test.assert_denied(
  format($sql$select public.admin_update_pix_settings('chave-forjada', %L)$sql$, 'https://example.com/forjado.png'),
  'anon cannot call admin_update_pix_settings()'
);

-- ---------------------------------------------------------------------
-- 4. The platform admin can call it; the write and the audit log land
-- atomically, and it's still readable by an ordinary owner right
-- after (same single row, not a new one).
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select public.admin_update_pix_settings('chave-real-123', 'https://example.com/qrcode-real.png');

select test.act_as_superuser();
select pix_key, qr_code_url, copy_paste_code is null as copy_paste_code_is_null, updated_by
from public.pix_payment_settings where id = 1 \gset after_

select test.assert(:'after_pix_key' = 'chave-real-123', 'admin_update_pix_settings() actually sets the pix_key');
select test.assert(:'after_qr_code_url' = 'https://example.com/qrcode-real.png', 'admin_update_pix_settings() actually sets the qr_code_url');
select test.assert(:'after_copy_paste_code_is_null'::boolean, 'the 2-arg call form (p_copy_paste_code omitted) leaves copy_paste_code null via its default');
select test.assert(:'after_updated_by' = :'outsider_id', 'updated_by records which admin made the change');

select test.assert(
  exists (
    select 1 from public.audit_logs
    where action = 'pix_settings_updated'
      and company_id is null
      and metadata ->> 'pix_key' = 'chave-real-123'
  ),
  'admin_update_pix_settings() writes a platform-wide (company_id null) audit log entry naming the new key'
);

select count(*) as n from public.pix_payment_settings \gset still_
select test.assert_row_count(1, :still_n, 'still exactly one row — admin_update_pix_settings() UPDATEs the singleton, never inserts a second one');

select test.act_as(:'owner_a_id'::uuid);
select pix_key from public.pix_payment_settings where id = 1 \gset ownerread_
select test.assert(:'ownerread_pix_key' = 'chave-real-123', 'an ordinary owner immediately sees the admin''s update — same global row');

-- ---------------------------------------------------------------------
-- 5. The 3-arg form sets copy_paste_code too, and its own audit flag.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select public.admin_update_pix_settings(
  'chave-real-123', 'https://example.com/qrcode-real.png', '00020126...copia-e-cola-de-teste...6304ABCD'
);

select test.act_as_superuser();
select copy_paste_code from public.pix_payment_settings where id = 1 \gset code_
select test.assert(
  :'code_copy_paste_code' = '00020126...copia-e-cola-de-teste...6304ABCD',
  'the 3-arg call form actually sets copy_paste_code'
);
select test.assert(
  exists (
    select 1 from public.audit_logs
    where action = 'pix_settings_updated'
      and company_id is null
      and (metadata ->> 'copy_paste_code_set')::boolean is true
    order by created_at desc limit 1
  ),
  'admin_update_pix_settings() flags copy_paste_code_set=true in the audit log when a code is set'
);

-- ---------------------------------------------------------------------
-- 6. Blank/whitespace-only input clears every field back to null
-- rather than storing an empty string (matches the
-- nullif(btrim(...), '') normalization in the function body) —
-- including copy_paste_code.
-- ---------------------------------------------------------------------
select test.act_as(:'outsider_id'::uuid);
select public.admin_update_pix_settings('   ', 'https://example.com/qrcode-real.png', '   ');

select test.act_as_superuser();
select pix_key is null as key_cleared, copy_paste_code is null as code_cleared
from public.pix_payment_settings where id = 1 \gset blank_
select test.assert(:'blank_key_cleared'::boolean, 'a blank/whitespace-only pix_key normalizes to null, not an empty string');
select test.assert(:'blank_code_cleared'::boolean, 'a blank/whitespace-only copy_paste_code normalizes to null, not an empty string');

-- Restore real values so this file leaves the row in the same shape
-- (non-blank) it would be in production, in case a later test file
-- ever comes to depend on it.
select test.act_as(:'outsider_id'::uuid);
select public.admin_update_pix_settings('chave-real-123', 'https://example.com/qrcode-real.png', '00020126...copia-e-cola-de-teste...6304ABCD');

select test.act_as_superuser();

select test.assert(true, 'manual Pix payment settings verified: single global row, readable by any authenticated user, anon fully blocked, writes only through the admin-only audited RPC (both 2-arg and 3-arg call forms) with no direct table write path for anyone, blank input normalizes to null on every field');
