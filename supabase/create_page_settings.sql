-- Create page_settings table
create table public.page_settings (
    id uuid not null default gen_random_uuid(),
    page_path text not null,
    is_public boolean not null default true,
    description text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint page_settings_pkey primary key (id),
    constraint page_settings_page_path_key unique (page_path)
);

-- Enable RLS
alter table public.page_settings enable row level security;

-- Policies
create policy "Enable read access for all users" on public.page_settings
    for select using (true);

create policy "Enable all access for admins" on public.page_settings
    for all using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
    );

-- Seed initial data
insert into public.page_settings (page_path, description) values
('index.html', 'Top Page'),
('about.html', 'SoDRéとは'),
('schedule.html', 'Schedule'),
('members.html', 'Members'),
('plans.html', 'Plans'),
('voices.html', 'Voices'),
('news.html', 'News List'),
('topics.html', 'Topics List'),
('diary.html', 'Diary List'),
('contact.html', 'Contact & Q&A'),
('application.html', 'Application Form'),
('members-area.html', 'Members Area (Should be Private)'),
('member/leo.html', 'Member: Leo'),
('member/mizu.html', 'Member: Mizu'),
('member/tajiaki.html', 'Member: Tajiaki'),
('login.html', 'Login Page'),
('admin.html', 'Admin Dashboard');
