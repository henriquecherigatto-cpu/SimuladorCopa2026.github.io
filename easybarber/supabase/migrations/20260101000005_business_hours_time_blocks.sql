-- business_hours: one row per company per weekday (0 = Sunday .. 6 =
-- Saturday). The agenda screens must never show or allow booking
-- outside these hours.
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  start_time time not null default '08:00',
  end_time time not null default '18:00',
  unique (company_id, day_of_week),
  check (not is_open or start_time < end_time)
);

comment on table public.business_hours is
  'Weekly operating hours per company. A closed day (is_open = false) must block new appointments at the database level too — see appointments_within_business_hours trigger.';

-- time_blocks: one-off exceptions — a professional's vacation, a
-- company-wide holiday, a maintenance window, etc. professional_id
-- null means the whole company is blocked for that interval.
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  professional_id uuid references public.professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

comment on table public.time_blocks is
  'One-off blocked intervals (vacation, holiday, maintenance). professional_id = null blocks the whole company.';

create index time_blocks_company_id_idx on public.time_blocks (company_id);
create index time_blocks_professional_id_idx on public.time_blocks (professional_id);
create index time_blocks_range_idx on public.time_blocks using gist (
  professional_id,
  tstzrange(starts_at, ends_at)
);
