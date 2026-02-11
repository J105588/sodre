-- Add allow_comments column to board_posts
ALTER TABLE public.board_posts
ADD COLUMN allow_comments boolean DEFAULT true;

-- Create board_comments table
CREATE TABLE public.board_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES public.board_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- Policies for board_comments

-- SELECT: Same visibility as the parent post
CREATE POLICY "View comments"
  ON public.board_comments FOR SELECT
  USING (
    EXISTS (
        SELECT 1 FROM public.board_posts
        WHERE id = board_comments.post_id
        AND (
            -- Public/All Board
            group_id IS NULL
            OR
            -- Member of the group
            EXISTS (
                SELECT 1 FROM public.group_members
                WHERE group_id = board_posts.group_id AND user_id = auth.uid()
            )
            OR
            -- Admin
            EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
            )
        )
    )
  );

-- INSERT: Authenticated users can insert if parent post allows comments
CREATE POLICY "Create comments"
  ON public.board_comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.board_posts
        WHERE id = board_comments.post_id
        AND allow_comments = true
        AND (
            -- Must typically be able to SEE the post to comment on it
            group_id IS NULL
            OR
            EXISTS (
                SELECT 1 FROM public.group_members
                WHERE group_id = board_posts.group_id AND user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
            )
        )
    )
  );

-- DELETE: Owner or Admin
CREATE POLICY "Delete comments"
  ON public.board_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    OR
    -- Post author can also delete comments on their post? (Optional, adding for moderation)
    EXISTS (
        SELECT 1 FROM public.board_posts
        WHERE id = board_comments.post_id AND user_id = auth.uid()
    )
  );
