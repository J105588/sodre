-- Debug Script: Check your Profile and Admin Status
-- Run this in Supabase SQL Editor

-- Replace with your email
select 
  u.id as auth_id,
  u.email,
  p.id as profile_id,
  p.display_name,
  p.is_admin
from auth.users u
left join public.profiles p on u.id = p.id
where u.email in ('user1@example.com', 'user2@example.com'); -- Add your email here
