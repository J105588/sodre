-- Migration: Add new interview pages to page_settings
-- Date: 2026-03-23

INSERT INTO public.page_settings (page_path, description) VALUES
('voices/yui.html', 'Voice: YUI 様'),
('voices/aoyama.html', 'Voice: 青山 克彦 様')
ON CONFLICT (page_path) DO NOTHING;

-- Optionally update the description of interview.html if it's already registered
UPDATE public.page_settings 
SET description = 'Voice: Interview List' 
WHERE page_path = 'voices/interview.html';
