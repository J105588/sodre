-- Restore board_posts policies to previous state
-- Drops the restrictive policies added by accident and restores standard ones.

BEGIN;

-- 1. Drop the "accidental" restrictive policies
DROP POLICY IF EXISTS "View posts based on role" ON public.board_posts;
DROP POLICY IF EXISTS "Insert own posts" ON public.board_posts;
DROP POLICY IF EXISTS "Update own posts" ON public.board_posts;
DROP POLICY IF EXISTS "Delete posts based on role" ON public.board_posts;

-- 2. Restore "Enable read access for all users"
-- Assuming this allows authenticated users to read all posts (frontend filters groups)
CREATE POLICY "Enable read access for all users"
ON public.board_posts
FOR SELECT
TO authenticated
USING (true);

-- 3. Restore "Enable insert for authenticated users"
CREATE POLICY "Enable insert for authenticated users"
ON public.board_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Restore "Enable update for users based on user_id"
CREATE POLICY "Enable update for users based on user_id"
ON public.board_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Restore "Enable delete for users based on user_id"
CREATE POLICY "Enable delete for users based on user_id"
ON public.board_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Restore "Admins can delete any post"
-- Using the check_is_admin() helper if available, or direct check
-- (Assuming check_is_admin exists from previous migrations, otherwise inline)
CREATE POLICY "Admins can delete any post"
ON public.board_posts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

COMMIT;
