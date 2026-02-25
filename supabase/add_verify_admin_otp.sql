-- Function to Verify OTP *without* resetting password
create or replace function public.verify_admin_otp(
  p_email text,
  p_otp text
)
returns boolean
language plpgsql
security definer -- Runs as superuser to access verification_codes
as $$
declare
  v_code_record record;
  v_is_super boolean;
begin
  -- 1. Check if the calling user is a superadmin
  -- Must be called by an authenticated user
  if auth.uid() is null then
    return false;
  end if;
  
  select is_superadmin into v_is_super from public.profiles where id = auth.uid();
  if v_is_super is not true then
    return false;
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
    return false;
  end if;

  -- 3. Clean up the used OTP (and older ones for this email)
  delete from public.verification_codes where email = p_email;

  return true;
end;
$$;

-- Grant access to authenticated users (the function itself checks for superadmin)
grant execute on function public.verify_admin_otp(text, text) to authenticated;
