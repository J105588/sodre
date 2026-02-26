-- Add App Lock fields to profiles to prevent localStorage bypass
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS app_lock_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS app_lock_credential_id TEXT;
