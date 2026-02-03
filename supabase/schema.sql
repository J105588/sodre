-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create posts table
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  category text not null check (category in ('news', 'diary', 'topics')),
  title text not null,
  content text not null, -- Stores HTML from Rich Text Editor
  images jsonb default '[]'::jsonb, -- Array of image URLs
  published boolean default true
);

-- Enable Row Level Security
alter table public.posts enable row level security;

-- Policy: Everyone can read published posts
create policy "Public can view published posts"
  on public.posts for select
  using (published = true);

-- Policy: Authenticated users (Admins) can do everything
create policy "Admins can do everything"
  on public.posts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Storage Setup (You usually do this in the UI, but here is the policy if bucket exists)
-- 1. Create a bucket named 'images' in Supabase Storage UI.
-- 2. Add these policies for the 'images' bucket:

-- Policy: Public can view images
-- (Apply to storage.objects)
-- create policy "Public Access"
--   on storage.objects for select
--   using ( bucket_id = 'images' );

-- Policy: Authenticated users can upload
-- create policy "Auth Upload"
--   on storage.objects for insert
--   with check ( bucket_id = 'images' and auth.role() = 'authenticated' );
