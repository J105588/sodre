-- RPC to check if an email exists in auth.users
-- Created for Password Reset flow to verify email before sending OTP.

create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
security definer -- Required to access auth.users
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from auth.users where email = p_email
  ) into v_exists;
  
  return v_exists;
end;
$$;

-- Grant access to public/anon so it can be called from login page
grant execute on function public.check_email_exists(text) to anon, authenticated, service_role;
