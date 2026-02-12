
-- Allow users to update their own comments
CREATE POLICY "Users can update own comments"
ON public.board_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow Superadmins to update any comment
CREATE POLICY "Superadmins can update any comment"
ON public.board_comments
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
