-- Add is_superadmin column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_superadmin boolean DEFAULT false;

-- Update RPC to prevent deleting superadmins
-- Drop first to ensure signature change if needed (though args are same)
DROP FUNCTION IF EXISTS public.delete_user_by_admin(uuid);

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requester_is_admin boolean;
  target_is_superadmin boolean;
BEGIN
  -- 1. Check if the requesting user is an admin
  SELECT is_admin INTO requester_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF requester_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Access Denied: Only admins can delete users.';
  END IF;

  -- 2. Check if target is superadmin
  SELECT is_superadmin INTO target_is_superadmin
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_is_superadmin IS TRUE THEN
    RAISE EXCEPTION 'Action Forbidden: Cannot delete a Superadmin user.';
  END IF;

  -- 3. Clean up dependencies
  DELETE FROM public.group_members WHERE user_id = target_user_id;
  DELETE FROM public.board_posts WHERE user_id = target_user_id;
  UPDATE public.user_management SET created_by = NULL WHERE created_by = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$;

-- Trigger to protect is_superadmin modifications and demotion
CREATE OR REPLACE FUNCTION public.protect_superadmin_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow changes if performed by service_role (dashboard/direct DB)
  -- BUT 'authenticated' users (even admins) should not touch this.
  -- Supabase Auth rule: role is 'authenticated' for logged in users.
  
  IF auth.role() = 'authenticated' THEN
      -- 1. Prevent changing is_superadmin flag
      IF NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin THEN
          RAISE EXCEPTION 'Cannot modify superadmin status via API.';
      END IF;

      -- 2. Prevent demoting a superadmin (removing is_admin)
      IF OLD.is_superadmin IS TRUE AND NEW.is_admin IS NOT TRUE THEN
          RAISE EXCEPTION 'Cannot remove admin rights from a Superadmin.';
      END IF;
      
      -- 3. Prevent renaming a superadmin? (User said 'deleted or demoted', didn't say renamed. Let's allow renaming for now unless asked.)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_update_protect_sw ON public.profiles;
CREATE TRIGGER on_profile_update_protect_sw
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_superadmin_changes();
