
-- 1. Add is_first_login to profiles
alter table public.profiles 
add column if not exists is_first_login boolean default true;

-- 2. Update the reset_password_with_otp function to set is_first_login = false
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

  -- 4. Mark as NOT first login anymore
  update public.profiles
  set is_first_login = false
  where id = v_user_id;

  -- 5. Clean up used OTP (and older ones for this email)
  delete from public.verification_codes where email = p_email;

  return 'success';
end;
$$;
