-- Create a secure helper function to check admin status
-- This avoids RLS recursion loop or permission issues on profiles table
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Runs with privileges of the creator (usually postgres/service_role)
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
$$;

-- Drop existing policy if it exists (to avoid errors or duplicates)
DROP POLICY IF EXISTS "Allow admins all" ON public.system_settings;

-- Re-create the policy using the helper function
CREATE POLICY "Allow admins all"
ON public.system_settings
FOR ALL
TO authenticated
USING ( public.check_is_admin() )
WITH CHECK ( public.check_is_admin() );

-- Ensure Authenticated users can INSERT/UPDATE if they pass the policy
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;
