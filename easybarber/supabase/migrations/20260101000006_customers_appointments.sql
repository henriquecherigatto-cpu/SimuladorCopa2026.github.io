-- customers: end clients of a company. Only the data needed to run the
-- product is collected.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'End clients of a company. A company must never be able to read another company''s customers — enforced by RLS, not just by UI filtering.';

create index customers_company_id_idx on public.customers (company_id);
create index customers_company_id_phone_idx on public.customers (company_id, phone);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Needed so appointments can enforce "customer belongs to the same
-- company as the appointment" via a composite foreign key below.
alter table public.customers
  add constraint customers_company_id_id_key unique (company_id, id);

-- appointments: the core scheduling entity.
create type public.appointment_status as enum (
  'agendado',
  'confirmado',
  'concluido',
  'cancelado'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'agendado',
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  -- A customer, professional and service must all belong to the same
  -- company as the appointment itself. Without this, a client could
  -- (if it ever got past RLS) point an appointment's professional_id
  -- at another company's staff.
  constraint appointments_same_company_customer
    foreign key (company_id, customer_id)
    references public.customers (company_id, id),
  constraint appointments_same_company_professional
    foreign key (company_id, professional_id)
    references public.professionals (company_id, id),
  constraint appointments_same_company_service
    foreign key (company_id, service_id)
    references public.services (company_id, id)
);

comment on table public.appointments is
  'Each appointment is pinned to one company via composite foreign keys, so even a bug that let a cross-company id through would be rejected by the database.';

create index appointments_company_id_idx on public.appointments (company_id);
create index appointments_professional_id_starts_at_idx on public.appointments (professional_id, starts_at);
create index appointments_customer_id_idx on public.appointments (customer_id);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- THE core concurrency guarantee: two appointments for the same
-- professional can never overlap in time, enforced by Postgres itself
-- (not application code), so it holds even under concurrent requests.
-- Cancelled appointments don't block new bookings over the same slot.
alter table public.appointments
  add constraint appointments_no_overlap_per_professional
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status <> 'cancelado');

-- Reject appointments outside the company's configured business hours
-- or landing inside a time_block, at the database level — the UI must
-- already prevent this, but the server/database is the real guard.
create or replace function public.check_appointment_within_hours()
returns trigger
language plpgsql
as $$
declare
  hours public.business_hours%rowtype;
  blocked boolean;
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  if new.starts_at::date <> new.ends_at::date then
    raise exception 'Appointments must start and end on the same calendar day.'
      using errcode = 'P0001';
  end if;

  select * into hours
  from public.business_hours
  where company_id = new.company_id
    and day_of_week = extract(dow from new.starts_at)::smallint;

  if not found or not hours.is_open then
    raise exception 'The company is closed on this day.'
      using errcode = 'P0001';
  end if;

  if new.starts_at::time < hours.start_time or new.ends_at::time > hours.end_time then
    raise exception 'The appointment falls outside business hours.'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.time_blocks tb
    where tb.company_id = new.company_id
      and (tb.professional_id is null or tb.professional_id = new.professional_id)
      and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) into blocked;

  if blocked then
    raise exception 'The requested time overlaps a blocked interval (time off, holiday, etc).'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger appointments_within_business_hours
  before insert or update of starts_at, ends_at, professional_id, company_id, status
  on public.appointments
  for each row execute function public.check_appointment_within_hours();
