
-- Allow Superadmins to update any board_posts

-- First, drop existing policy if it conflicts or is too narrow (Update own posts)
-- Actually, we can keep "Update own posts" and add a new OR policy for Superadmins,
-- BUT Supabase policies are permissive (OR), so adding a new one is safer/easier.

CREATE POLICY "Superadmins can update any post"
ON public.board_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_superadmin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_superadmin = true
  )
);
