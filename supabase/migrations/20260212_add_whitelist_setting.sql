-- Add maintenance_whitelist key to system_settings
-- Default includes essential pages to avoid lockout

INSERT INTO public.system_settings (key, value)
VALUES (
    'maintenance_whitelist', 
    '["admin.html","maintenance.html"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Permissions are already handled by the previous comprehensive fix (public read ANY key is not enabled, 
-- but we enabled 'maintenance_mode'. We need to ensure 'maintenance_whitelist' is also readable).

-- Update the public read policy to include 'maintenance_whitelist'
DROP POLICY IF EXISTS "Anyone can read maintenance_mode" ON public.system_settings;

CREATE POLICY "Anyone can read maintenance settings"
ON public.system_settings
FOR SELECT
TO public
USING (key IN ('maintenance_mode', 'maintenance_whitelist'));
