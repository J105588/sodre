-- COMPREHENSIVE FIX FOR MAINTENANCE MODE
-- Run this entire script in Supabase SQL Editor.

BEGIN;

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create Admin Check Helper (Security Definer to bypass recursion)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
$$;

-- 4. Clean Existing Policies (To avoid duplicates/conflicts)
DROP POLICY IF EXISTS "Allow public read maintenance_mode" ON public.system_settings;
DROP POLICY IF EXISTS "Allow admins all" ON public.system_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.system_settings;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.system_settings;

-- 5. Create Fresh Policies

-- Policy A: Public Read (Anon + Authenticated)
-- Allows reading ONLY the 'maintenance_mode' key.
CREATE POLICY "Public Read Maintenance" 
ON public.system_settings 
FOR SELECT 
TO public
USING (key = 'maintenance_mode');

-- Policy B: Admin Full Access
-- Allows Admins to do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admin Full Access"
ON public.system_settings
FOR ALL
TO authenticated
USING ( public.check_is_admin() )
WITH CHECK ( public.check_is_admin() );

-- 6. Grant Table Permissions (Crucial for Anon/Public access)
GRANT SELECT ON TABLE public.system_settings TO anon;
GRANT SELECT ON TABLE public.system_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;

-- 7. Insert Default Data (if missing)
INSERT INTO public.system_settings (key, value)
VALUES (
    'maintenance_mode', 
    '{"enabled": false, "message": "現在メンテナンス中です。しばらくお待ちください。"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 8. Enable Realtime
-- This adds the table to the publication if it's not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
  END IF;
END $$;

COMMIT;
