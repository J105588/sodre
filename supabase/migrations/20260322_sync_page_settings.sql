-- Migration: Sync all HTML pages into page_settings
-- Uses ON CONFLICT to skip pages that already exist (idempotent)
-- Date: 2026-03-22

INSERT INTO public.page_settings (page_path, description) VALUES
-- Root pages (既存のものはスキップ)
('index.html', 'Top Page'),
('about.html', 'SoDRéとは'),
('schedule.html', 'Schedule'),
('members.html', 'Members'),
('plans.html', 'Plans'),
('voices.html', 'Voices'),
('news.html', 'News List'),
('topics.html', 'Topics List'),
('diary.html', 'Diary List'),
('qa.html', 'Q&A'),
('application.html', 'Application Form'),
('members-area.html', 'Members Area'),
('login.html', 'Login Page'),
('admin.html', 'Admin Dashboard'),
('app.html', 'App Page'),
('maintenance.html', 'Maintenance Page'),
('update.html', 'Update Page'),
-- Member pages
('member/leo.html', 'Member: Leo'),
('member/mizu.html', 'Member: Mizu'),
('member/tajiaki.html', 'Member: Tajiaki'),
('member/hibiki.html', 'Member: Hibiki'),
('member/jun.html', 'Member: Jun'),
('member/towa.html', 'Member: Towa'),
-- Voices sub-pages
('voices/doi.html', 'Voice: Doi'),
('voices/interview.html', 'Voice: Interview'),
('voices/participants.html', 'Voice: Participants'),
('voices/psychologist.html', 'Voice: Psychologist'),
('voices/sasamoto.html', 'Voice: Sasamoto')
ON CONFLICT (page_path) DO NOTHING;
