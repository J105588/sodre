-- Create page_settings table if not exists
CREATE TABLE IF NOT EXISTS public.page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_path TEXT NOT NULL UNIQUE,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Turn on RLS
ALTER TABLE public.page_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Allow public read page_settings" ON public.page_settings;
DROP POLICY IF EXISTS "Allow admins all page_settings" ON public.page_settings;

-- Policy: Allow public read access (for checking if page is public)
CREATE POLICY "Allow public read page_settings" 
ON public.page_settings 
FOR SELECT 
USING (true);

-- Policy: Allow admins all access
CREATE POLICY "Allow admins all page_settings"
ON public.page_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Insert default pages (Upsert to avoid duplicates)
-- Only pages that use page-guard.js
INSERT INTO public.page_settings (page_path, description, is_public)
VALUES 
    -- Main Pages
    ('index.html', 'トップページ', true),
    ('news.html', 'ニュース一覧', true),
    ('diary.html', 'ダイアリー', true),
    ('topics.html', 'トピックス', true),
    ('schedule.html', 'スケジュール', true),
    ('about.html', 'SoDRéについて', true),
    ('voices.html', '参加者の声', true),
    ('plans.html', 'プラン・料金', true),
    ('application.html', '申し込みフォーム', true),
    ('contact.html', 'お問い合わせ', true),
    ('members.html', 'メンバー紹介', true),
    ('members-area.html', '会員限定エリア', true),
    ('login.html', 'ログインページ', true),
    
    -- Member Profiles
    ('mizu.html', 'メンバー詳細: mizu', true),
    ('tajiaki.html', 'メンバー詳細: tajiaki', true),
    ('leo.html', 'メンバー詳細: leo', true)

ON CONFLICT (page_path) 
DO UPDATE SET 
    description = EXCLUDED.description,
    updated_at = now();

-- Enable Realtime for page_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'page_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.page_settings;
  END IF;
END $$;
