-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Turn on RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to READ 'maintenance_mode' key
CREATE POLICY "Allow public read maintenance_mode" 
ON public.system_settings 
FOR SELECT 
USING (key = 'maintenance_mode');

-- Policy: Allow admins to do EVERYTHING
-- Note: This assumes you have an 'is_admin' check or similar in profiles, 
-- but for simplicity in RLS often we rely on service role or specific auth checks.
-- However, since we are fetching this from client, we need a policy.
-- Re-using the logic commonly used: checking public.profiles for admin status
CREATE POLICY "Allow admins all"
ON public.system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Insert default maintenance mode setting if not exists
INSERT INTO public.system_settings (key, value)
VALUES (
    'maintenance_mode', 
    '{"enabled": false, "message": "現在メンテナンス中です。しばらくお待ちください。"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Enable Realtime for this table
-- Note: In Supabase, you often need to bundle this with publication setup.
-- If 'supabase_realtime' publication exists, add the table to it.
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
