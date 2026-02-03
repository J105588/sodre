-- User Management via Table (Admin Only)

-- 1. Table to Stage New Users
-- Admins insert here, Trigger creates the actual Auth User and Profile
create table public.user_management (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  initial_password text not null,
  display_name text not null,
  status text default 'pending', -- pending, created, error
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id)
);

-- RLS
alter table public.user_management enable row level security;

create policy "Admins can manage user_management"
  on public.user_management for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );

-- 2. Trigger Function to Create User
create or replace function public.process_new_user()
returns trigger as $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
begin
  -- Only process 'pending' rows
  if new.status = 'pending' then
    begin
      -- 1. Hash Password
      v_encrypted_pw := crypt(new.initial_password, gen_salt('bf'));
      
      -- 2. Insert into auth.users
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        uuid_generate_v4(),
        'authenticated',
        'authenticated',
        new.email,
        v_encrypted_pw,
        now(),
        null,
        null,
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name', new.display_name),
        now(),
        now()
      ) returning id into v_user_id;

      -- 3. Insert into public.profiles (Trigger on auth.users might do this, but being explicit is safer/faster here if trigger logic overlaps)
      -- Our previous schema_members.sql has a trigger `handle_new_user`.
      -- That trigger inserts into profiles based on `new.raw_user_meta_data->>'full_name'`.
      -- So we DON'T need to manually insert into profiles if that trigger is active.
      -- However, `handle_new_user` does `do nothing` on conflict.
      
      -- 4. Update status to created
      update public.user_management
      set status = 'created',
          error_message = null,
          initial_password = '***' -- Clear the password for security
      where id = new.id;
      
    exception when others then
      -- Capture error
      update public.user_management
      set status = 'error',
          error_message = SQLERRM
      where id = new.id;
    end;
  end if;
  return null; -- After trigger, return null is fine
end;
$$ language plpgsql security definer;

-- 3. Trigger Definition
drop trigger if exists on_user_management_insert on public.user_management;
create trigger on_user_management_insert
  after insert on public.user_management
  for each row execute procedure public.process_new_user();
