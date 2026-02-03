-- Calendar Management

-- 1. Calendar Event Types (Legend)
create table public.calendar_types (
  id uuid default uuid_generate_v4() primary key,
  label text not null, -- e.g. "Free Trial", "Workshop"
  color text not null, -- e.g. "#FF5733"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.calendar_types enable row level security;

-- Everyone can read
create policy "Public view calendar types"
  on public.calendar_types for select
  using ( true );

-- Admins can manage
create policy "Admins manage calendar types"
  on public.calendar_types for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );


-- 2. Calendar Events (Dates)
create table public.calendar_events (
  id uuid default uuid_generate_v4() primary key,
  event_date date not null,
  type_id uuid references public.calendar_types(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (event_date, type_id) -- Prevent duplicate same-type events on same day (optional)
);

alter table public.calendar_events enable row level security;

-- Everyone can read
create policy "Public view calendar events"
  on public.calendar_events for select
  using ( true );

-- Admins can manage
create policy "Admins manage calendar events"
  on public.calendar_events for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );
