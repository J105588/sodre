-- Create table for FCM tokens
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL,
    device_type TEXT DEFAULT 'web',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, token) -- Prevent duplicate tokens for same user
);

-- Enable RLS
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors on rerun
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.user_fcm_tokens;
DROP POLICY IF EXISTS "Admins can view all tokens" ON public.user_fcm_tokens;

-- Policies
CREATE POLICY "Users can view their own tokens"
    ON public.user_fcm_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
    ON public.user_fcm_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
    ON public.user_fcm_tokens
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
    ON public.user_fcm_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admin Policy (Optional: Allow admins to view all tokens helps in debugging)
CREATE POLICY "Admins can view all tokens"
    ON public.user_fcm_tokens
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );
