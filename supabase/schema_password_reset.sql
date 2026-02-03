-- Password Reset via GAS (OTP Verification)

-- 1. Table for Verification Codes (OTPs)
create table public.verification_codes (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.verification_codes enable row level security;

-- Only authenticated or service role can see/insert?
-- Actually, the GAS script (Service Role/Admin) will insert.
-- The Frontend (Public) needs to verify? No, Frontend calls RPC.
-- So we can keep this table private/admin-only.
create policy "Admins/ServiceRole can manage verification_codes"
  on public.verification_codes for all
  using ( exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) );


-- 2. Function to Verify OTP and Reset Password
create or replace function public.reset_password_with_otp(
  p_email text,
  p_otp text,
  p_new_password text
)
returns text -- 'success' or error message
language plpgsql
security definer -- Runs as superuser to update auth.users
as $$
declare
  v_user_id uuid;
  v_code_record record;
  v_encrypted_pw text;
begin
  -- 1. Check if user exists
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    return 'User not found';
  end if;

  -- 2. Verify OTP
  select * into v_code_record 
  from public.verification_codes 
  where email = p_email 
    and code = p_otp 
    and expires_at > now()
  order by created_at desc 
  limit 1;

  if v_code_record is null then
    return 'Invalid or expired OTP';
  end if;

  -- 3. Reset Password
  v_encrypted_pw := crypt(p_new_password, gen_salt('bf'));
  
  update auth.users
  set encrypted_password = v_encrypted_pw,
      updated_at = now()
  where id = v_user_id;

  -- 4. Clean up used OTP (and older ones for this email)
  delete from public.verification_codes where email = p_email;

  return 'success';
end;
$$;
