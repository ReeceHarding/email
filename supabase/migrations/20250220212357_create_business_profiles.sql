-- Enable the necessary extensions
create extension if not exists "uuid-ossp";

-- Create the business_profiles table
create table if not exists public.business_profiles (
  id uuid primary key default uuid_generate_v4(),
  business_name text,
  website_url text not null,
  owner_name text,
  owner_title text,
  owner_linkedin text,
  owner_email text,
  primary_email text,
  alternative_emails jsonb,
  phone_number text,
  address text,
  unique_selling_points jsonb,
  specialties jsonb,
  awards jsonb,
  year_established text,
  services jsonb,
  technologies jsonb,
  insurances_accepted jsonb,
  certifications jsonb,
  affiliations jsonb,
  testimonial_highlights jsonb,
  social_media_links jsonb,
  outreach_status text not null default 'pending',
  last_email_sent_at timestamptz,
  email_history jsonb,
  source_url text,
  source_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_business_profiles_website_url on public.business_profiles(website_url);
create index if not exists idx_business_profiles_outreach_status on public.business_profiles(outreach_status);

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
drop trigger if exists set_updated_at on public.business_profiles;
create trigger set_updated_at
  before update on public.business_profiles
  for each row
  execute function public.handle_updated_at();

-- Enable RLS
alter table public.business_profiles enable row level security;

-- Create policies
create policy "Enable read access for all users" on public.business_profiles
  for select
  using (true);

create policy "Enable insert access for all users" on public.business_profiles
  for insert
  with check (true);

create policy "Enable update access for all users" on public.business_profiles
  for update
  using (true);

-- Add unique constraint on website_url
alter table public.business_profiles
  add constraint business_profiles_website_url_key unique (website_url); 