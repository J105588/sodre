-- Create a new private bucket called 'images'
-- We use a DO block to avoid error if it already exists, or just accept that it might fail if it exists (which is fine)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- RLS is already enabled on storage.objects by default in Supabase.
-- We do NOT need to run 'alter table storage.objects enable row level security;' which causes permission errors.

-- Policies
-- Note: We drop existing policies if they exist to allow re-running this script cleanly.
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'images' );

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check ( bucket_id = 'images' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated users can update images" on storage.objects;
create policy "Authenticated users can update images"
  on storage.objects for update
  using ( bucket_id = 'images' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated users can delete images" on storage.objects;
create policy "Authenticated users can delete images"
  on storage.objects for delete
  using ( bucket_id = 'images' and auth.role() = 'authenticated' );
