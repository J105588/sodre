-- Ensure permissions are granted for public access
-- Even with RLS policies, the role needs GRANT usage on the table

GRANT SELECT ON TABLE public.system_settings TO anon;
GRANT SELECT ON TABLE public.system_settings TO authenticated;

-- Ensure service_role has full access (usually default but good to be explicit for helpers)
GRANT ALL ON TABLE public.system_settings TO service_role;

-- Re-verify Policy for Public Read just in case (Idempotent)
DROP POLICY IF EXISTS "Allow public read maintenance_mode" ON public.system_settings;

CREATE POLICY "Allow public read maintenance_mode" 
ON public.system_settings 
FOR SELECT 
TO public -- 'public' includes anon and authenticated
USING (key = 'maintenance_mode');
