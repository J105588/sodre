
-- RPC to delete a user by admin
-- This function allows an administrator to delete a user from auth.users.
-- It requires the caller to be an admin (checked via public.profiles).
-- UPDATED: Now handles foreign key constraints by deleting from public.profiles first.

create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer -- Runs with privileges of the creator (postgres/superuser) to delete from auth.users
as $$
declare
  requester_is_admin boolean;
begin
  -- 1. Check if the requesting user is an admin
  select is_admin into requester_is_admin
  from public.profiles
  where id = auth.uid();

  if requester_is_admin is not true then
    raise exception 'Access Denied: Only admins can delete users.';
  end if;

  -- 2. Clean up dependencies
  -- Delete group members first (though it often cascades from profiles, explicit is safer if not)
  delete from public.group_members where user_id = target_user_id;

  -- Delete board posts by this user (if not cascading)
  delete from public.board_posts where user_id = target_user_id;
  
  -- Update user_management created_by to null if this user created others
  update public.user_management set created_by = null where created_by = target_user_id;

  -- Delete profile (This is the one blocking auth.users delete)
  delete from public.profiles where id = target_user_id;

  -- 3. Delete the user from auth.users
  delete from auth.users where id = target_user_id;
  
end;
$$;
