-- companies: one row per barbearia on the platform. CNPJ is optional —
-- it is not required for the initial signup flow.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  cnpj text,
  phone text not null,
  address text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is
  'A barbearia (tenant). Every tenant-scoped table below carries a company_id referencing this table.';

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();
