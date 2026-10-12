-- professionals: the roster of people who perform services. profile_id
-- is nullable because a professional can be registered before they
-- have (or ever get) a login — only professionals linked to a profile
-- can sign in and see their own agenda.
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) > 0),
  phone text,
  role_title text not null default 'Barbeiro',
  color text not null default '#FF6B1A',
  active boolean not null default true,
  work_start time not null default '08:00',
  work_end time not null default '18:00',
  -- 0 = Sunday .. 6 = Saturday, matching extract(dow from ...).
  weekly_days_off smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professionals is
  'Roster of staff. Deactivating (active = false) must never delete the row, so appointment history stays intact.';

create index professionals_company_id_idx on public.professionals (company_id);
create unique index professionals_profile_id_company_id_idx
  on public.professionals (profile_id, company_id)
  where profile_id is not null;

-- Needed so appointments can enforce "professional belongs to the same
-- company as the appointment" via a composite foreign key.
alter table public.professionals
  add constraint professionals_company_id_id_key unique (company_id, id);

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

-- services: offered by a company. duration_min drives slot calculation.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  description text,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is
  'Services offered by a company. price_cents avoids floating point money; a service example here is never a universal price.';

create index services_company_id_idx on public.services (company_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- Needed so appointments can enforce "service belongs to the same
-- company as the appointment" via a composite foreign key.
alter table public.services
  add constraint services_company_id_id_key unique (company_id, id);

-- professional_services: which professionals are authorized to perform
-- which services.
create table public.professional_services (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);

comment on table public.professional_services is
  'Join table: a professional may only be booked for a service listed here.';

-- Data-integrity guard: a professional and a service must belong to
-- the same company. RLS policies already prevent a user from linking
-- rows across companies they don't belong to, but this trigger keeps
-- the table correct even for a bug in that logic or a service-role
-- script.
create or replace function public.check_professional_service_same_company()
returns trigger
language plpgsql
as $$
declare
  prof_company uuid;
  svc_company uuid;
begin
  select company_id into prof_company from public.professionals where id = new.professional_id;
  select company_id into svc_company from public.services where id = new.service_id;

  if prof_company is null or svc_company is null or prof_company <> svc_company then
    raise exception 'A professional can only be linked to a service from the same company.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger professional_services_same_company
  before insert or update on public.professional_services
  for each row execute function public.check_professional_service_same_company();
