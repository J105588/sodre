-- System Settings for Admin Credentials
-- This allows managing the Admin Login via a simple table.

-- 1. Enable pgcrypto for password hashing
create extension if not exists "pgcrypto";

-- 2. Create system_settings table
create table public.system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Only Admins can see this, basically)
alter table public.system_settings enable row level security;

create policy "Admins can view system settings"
  on public.system_settings for select
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );

create policy "Admins can update system settings"
  on public.system_settings for update
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );

-- 3. Initial Default Admin Settings (User should change these)
insert into public.system_settings (key, value, description)
values 
  ('admin_email', 'admin@example.com', 'Administrator Email Address'),
  ('admin_password', 'password123', 'Administrator Password (Plain text, synced to Auth)')
on conflict (key) do nothing;


-- 4. Function to Sync System Settings to Supabase Auth
create or replace function public.sync_admin_user()
returns trigger as $$
declare
  v_email text;
  v_password text;
  v_user_id uuid;
  v_encrypted_pw text;
begin
  -- Check if we are updating admin_email or admin_password
  if new.key = 'admin_email' or new.key = 'admin_password' then
    
    -- Get current values from the table (using 'new' for the one being updated)
    if new.key = 'admin_email' then
      v_email := new.value;
      select value into v_password from public.system_settings where key = 'admin_password';
    else
      v_password := new.value;
      select value into v_email from public.system_settings where key = 'admin_email';
    end if;

    -- Only proceed if we have both email and password
    if v_email is not null and v_password is not null then
      
      -- Check if admin user already exists in auth.users
      select id into v_user_id from auth.users where email = v_email;

      -- Hash the password (Supabase/GoTrue uses bcrypt)
      v_encrypted_pw := crypt(v_password, gen_salt('bf'));

      if v_user_id is not null then
        -- Update existing user
        update auth.users
        set encrypted_password = v_encrypted_pw,
            updated_at = now()
        where id = v_user_id;
      else
        -- Create new user (Requires strict permissions or superuser, usually runs as postgres)
        -- NOTE: Creating users via SQL trigger in Supabase is tricky because of permissions.
        -- We will attempt to insert into auth.users directly.
        
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
          updated_at,
          confirmation_token,
          email_change,
          email_change_token_new,
          recovery_token
        ) values (
          '00000000-0000-0000-0000-000000000000', -- Default instance_id
          uuid_generate_v4(),
          'authenticated',
          'authenticated',
          v_email,
          v_encrypted_pw,
          now(), -- Auto confirm
          null,
          null,
          '{"provider": "email", "providers": ["email"]}',
          '{"full_name": "System Admin"}',
          now(),
          now(),
          '',
          '',
          '',
          ''
        ) returning id into v_user_id;
        
        -- Also ensure this user is an Admin in profiles
        insert into public.profiles (id, email, display_name, is_admin)
        values (v_user_id, v_email, 'System Admin', true)
        on conflict (id) do update
        set is_admin = true;

      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer; -- Run as superuser/creator to access auth.users

-- 5. Create Trigger
drop trigger if exists on_system_settings_change on public.system_settings;
create trigger on_system_settings_change
  after insert or update on public.system_settings
  for each row execute procedure public.sync_admin_user();

-- 6. Trigger it once to ensure initial user is created
update public.system_settings set updated_at = now() where key = 'admin_email';
