-- Fix system_settings RLS to allow public read access (for maintenance check)
-- but keep write access restricted to admins.

-- 1. Drop existing restrictive policy
DROP POLICY IF EXISTS "Allow admins all" ON public.system_settings;

-- 2. Allow SELECT for everyone (Anon + Authenticated)
CREATE POLICY "Enable read access for all users"
ON public.system_settings
FOR SELECT
TO public
USING (true);

-- 3. Allow modification for Admins only
CREATE POLICY "Enable insert for admins"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK ( public.check_is_admin() );

CREATE POLICY "Enable update for admins"
ON public.system_settings
FOR UPDATE
TO authenticated
USING ( public.check_is_admin() )
WITH CHECK ( public.check_is_admin() );

CREATE POLICY "Enable delete for admins"
ON public.system_settings
FOR DELETE
TO authenticated
USING ( public.check_is_admin() );
