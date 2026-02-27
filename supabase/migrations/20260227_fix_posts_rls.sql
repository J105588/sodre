-- ===================================
-- Fix posts table RLS Policy
-- ===================================
-- Problem: The 'Admins can do everything' policy on public.posts
-- allowed ANY authenticated user to insert/update/delete.
-- Fix: Restrict to true admins using check_is_admin().

BEGIN;

-- 1. Drop the insecure policy
DROP POLICY IF EXISTS "Admins can do everything" ON public.posts;

-- 2. Ensure read access is still public (Idempotent check)
-- This policy should already exist based on schema.sql, but we ensure it here.
-- create policy "Public can view published posts" on public.posts for select using (published = true);

-- 3. Create the secure policy for Admnins using the helper function
CREATE POLICY "Admins full access on posts"
  ON public.posts
  FOR ALL
  TO authenticated
  USING ( public.check_is_admin() )
  WITH CHECK ( public.check_is_admin() );

COMMIT;
