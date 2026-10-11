-- plans: commercial catalogue, configurable by the platform admin.
-- Price and limits live here ONLY — the app must never hard-code a
-- plan price anywhere else.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  price_cents int not null check (price_cents >= 0),
  period text not null default 'mensal' check (period = 'mensal'),
  features jsonb not null default '[]'::jsonb,
  max_professionals int check (max_professionals is null or max_professionals > 0),
  max_customers int check (max_customers is null or max_customers > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Commercial plan catalogue. Null max_professionals/max_customers means unlimited.';

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- subscriptions: one row per company, tracking the COMMERCIAL state —
-- deliberately separate from whether a payment has literally cleared,
-- which lives in billing_events. status transitions are what the UI
-- and RLS gate access on.
create type public.subscription_status as enum (
  'ativa',
  'pendente',
  'tolerancia',
  'suspensa',
  'cancelada'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'pendente',
  current_period_end date,
  -- Configurable grace period (brief specifies 10 days); stored per
  -- subscription rather than hard-coded so it can change without a
  -- migration.
  grace_period_days int not null default 10 check (grace_period_days >= 0),
  grace_period_ends_at date,
  canceled_at timestamptz,
  external_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Commercial/subscription state per company, intentionally distinct from billing_events (the record of actual payment attempts).';

create index subscriptions_company_id_idx on public.subscriptions (company_id);
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- billing_events: an append-only ledger of payment-provider events
-- (e.g. Asaas webhooks). provider_event_id is unique so the webhook
-- handler can be called twice for the same event (at-least-once
-- delivery) without double-processing it — the handler should
-- `insert ... on conflict (provider_event_id) do nothing` and bail out
-- if no row was inserted.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null default 'asaas',
  provider_event_id text not null,
  event_type text not null,
  amount_cents int,
  status text not null,
  raw_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

comment on table public.billing_events is
  'Append-only ledger of payment-provider events. The unique (provider, provider_event_id) constraint makes webhook processing idempotent. Never marks a charge as paid from a checkout redirect alone — only from a verified provider event.';

create index billing_events_company_id_idx on public.billing_events (company_id);
