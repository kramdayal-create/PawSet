-- ===========================================================================
-- PawSet — Emergency & Care Planning App for Solo Pet Parents
-- Schema, RLS policies, and indexes
-- ===========================================================================
-- Conventions:
--   * Every user-scoped table carries user_id (references auth.users)
--   * RLS enforces user isolation on all tables
--   * Share links use secure random tokens and support revocation
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles: owner access" on profiles;
create policy "profiles: owner access" on profiles
  for all using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------------
create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  birth_date date,
  age_text text,
  sex text,
  photo_url text,
  microchip_number text,
  insurance_provider text,
  insurance_policy_number text,
  personality_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pets enable row level security;

drop policy if exists "pets: owner access" on pets;
create policy "pets: owner access" on pets
  for all using (auth.uid() = user_id);

create index if not exists pets_user_id_idx on pets(user_id);

-- ---------------------------------------------------------------------------
-- Pet Routines
-- ---------------------------------------------------------------------------
create table if not exists pet_routines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  feeding_schedule text,
  food_type text,
  portion_size text,
  treat_rules text,
  water_notes text,
  exercise_routine text,
  toilet_routine text,
  sleep_routine text,
  favourite_toys text,
  comfort_items text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pet_routines enable row level security;

drop policy if exists "pet_routines: owner access via pets" on pet_routines;
create policy "pet_routines: owner access via pets" on pet_routines
  for all using (
    exists (select 1 from pets where pets.id = pet_routines.pet_id and pets.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Pet Behaviour
-- ---------------------------------------------------------------------------
create table if not exists pet_behaviour (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  temperament text,
  anxiety_triggers text,
  likes text,
  dislikes text,
  stranger_reaction text,
  animal_reaction text,
  handling_notes text,
  escape_risk text,
  noise_sensitivity text,
  safety_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pet_behaviour enable row level security;

drop policy if exists "pet_behaviour: owner access via pets" on pet_behaviour;
create policy "pet_behaviour: owner access via pets" on pet_behaviour
  for all using (
    exists (select 1 from pets where pets.id = pet_behaviour.pet_id and pets.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Pet Medical
-- ---------------------------------------------------------------------------
create table if not exists pet_medical (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  vet_name text,
  vet_practice text,
  vet_phone text,
  vet_email text,
  vet_address text,
  known_conditions text,
  medications text,
  medication_instructions text,
  allergies text,
  vaccination_notes text,
  special_care_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pet_medical enable row level security;

drop policy if exists "pet_medical: owner access via pets" on pet_medical;
create policy "pet_medical: owner access via pets" on pet_medical
  for all using (
    exists (select 1 from pets where pets.id = pet_medical.pet_id and pets.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_type text,
  relationship text,
  phone text,
  email text,
  notes text,
  can_contact_in_emergency boolean not null default false,
  has_home_access boolean not null default false,
  visible_in_shared_guide boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contacts enable row level security;

drop policy if exists "contacts: owner access" on contacts;
create policy "contacts: owner access" on contacts
  for all using (auth.uid() = user_id);

create index if not exists contacts_user_id_idx on contacts(user_id);

-- ---------------------------------------------------------------------------
-- Emergency Plans
-- ---------------------------------------------------------------------------
create table if not exists emergency_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_contact_id uuid references contacts(id) on delete set null,
  backup_contact_id uuid references contacts(id) on delete set null,
  preferred_carer_id uuid references contacts(id) on delete set null,
  spare_key_contact_id uuid references contacts(id) on delete set null,
  access_notes text,
  pet_carrier_location text,
  food_location text,
  medication_location text,
  vet_authorisation_note text,
  emergency_budget_guidance text,
  unreachable_after_hours integer,
  general_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table emergency_plans enable row level security;

drop policy if exists "emergency_plans: owner access" on emergency_plans;
create policy "emergency_plans: owner access" on emergency_plans
  for all using (auth.uid() = user_id);

create index if not exists emergency_plans_user_id_idx on emergency_plans(user_id);

-- ---------------------------------------------------------------------------
-- Share Links
-- ---------------------------------------------------------------------------
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  title text,
  include_basic_details boolean not null default true,
  include_routine boolean not null default true,
  include_behaviour boolean not null default true,
  include_medical boolean not null default false,
  include_contacts boolean not null default false,
  include_access_notes boolean not null default false,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table share_links enable row level security;

drop policy if exists "share_links: owner access" on share_links;
create policy "share_links: owner access" on share_links
  for all using (auth.uid() = user_id);

-- Allow public to read active share links by token (via service role in API)
create index if not exists share_links_token_idx on share_links(token);
create index if not exists share_links_user_id_idx on share_links(user_id);

-- ---------------------------------------------------------------------------
-- Plan Reviews (last reviewed date tracking)
-- ---------------------------------------------------------------------------
create table if not exists plan_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  notes text
);

alter table plan_reviews enable row level security;

drop policy if exists "plan_reviews: owner access" on plan_reviews;
create policy "plan_reviews: owner access" on plan_reviews
  for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for pet photos (run once manually or via Supabase dashboard)
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('pet-photos', 'pet-photos', true)
-- on conflict (id) do nothing;
