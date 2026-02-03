-- NEW TABLES FOR MEMBERS AREA

-- 1. Profiles (Extends auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  display_name text,
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid error on multiple runs (idempotent-ish)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Groups
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.groups enable row level security;

create policy "Groups are viewable by authenticated users"
  on public.groups for select
  using ( auth.role() = 'authenticated' );

create policy "Only Admins can insert/update/delete groups"
  on public.groups for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );


-- 3. Group Members (Junction table)
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  can_post boolean default true, -- Posting authority setting
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Group members viewable by authenticated users"
  on public.group_members for select
  using ( auth.role() = 'authenticated' );

create policy "Only Admins can manage group members"
  on public.group_members for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );


-- 4. Board Posts (Bulletin Board)
create table public.board_posts (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade, -- NULL for "All Members" board
  user_id uuid references public.profiles(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.board_posts enable row level security;

-- Policy for SELECT
create policy "View posts"
  on public.board_posts for select
  using (
    auth.role() = 'authenticated' and (
      group_id is null -- Public/All Board
      or
      exists ( -- Or user is a member of the group
        select 1 from public.group_members
        where group_id = board_posts.group_id and user_id = auth.uid()
      )
      or
      exists ( -- Or user is admin
        select 1 from public.profiles where id = auth.uid() and is_admin = true
      )
    )
  );

-- Policy for INSERT
create policy "Create posts"
  on public.board_posts for insert
  with check (
    auth.role() = 'authenticated' and
    auth.uid() = user_id and ( -- Ensure user is posting as themselves
      (group_id is null) -- Public Board (All members can post?)
      or
      exists ( -- Or user is a member AND has posting authority
        select 1 from public.group_members
        where group_id = board_posts.group_id and user_id = auth.uid() and can_post = true
      )
      or
      exists ( -- Or user is admin
        select 1 from public.profiles where id = auth.uid() and is_admin = true
      )
    )
  );

-- Policy for DELETE (User own post or Admin)
create policy "Delete posts"
  on public.board_posts for delete
  using (
    auth.uid() = user_id
    or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
