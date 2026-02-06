-- Fix for Admin User Update Failures
-- Run this in Supabase SQL Editor

-- Allow Admins to update any profile (to promote/demote or rename users)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
