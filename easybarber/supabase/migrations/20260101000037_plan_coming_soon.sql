-- The Profissional plan's main differentiator (the automated WhatsApp
-- booking confirmation) needs the platform's own Meta Business
-- verification — which needs a CNPJ the company doesn't have yet —
-- before it can actually send anything in production (the WhatsApp
-- Cloud API migration itself is fully built and tested; see
-- docs/whatsapp-integration.md). Pending that, the plan stays in the
-- catalog (so its id/pricing/features keep their existing meaning,
-- and re-enabling it later is a one-row flip) but is marked "coming
-- soon": still shown on /plano so prospective customers know it's on
-- the way, but never offered during signup and never purchasable even
-- via a stale link (enforced server-side in createCheckoutSession(),
-- not just hidden in the UI).
alter table public.plans add column coming_soon boolean not null default false;

comment on column public.plans.coming_soon is
  'True hides this plan from new signups (onboarding) and blocks checkout entirely, while still listing it on /plano as not-yet-available — distinct from active, which hides a plan everywhere.';

update public.plans set coming_soon = true where name = 'Profissional';
