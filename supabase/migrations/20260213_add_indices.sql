-- Add indices for performance optimization

-- board_posts
CREATE INDEX IF NOT EXISTS idx_board_posts_group_id ON public.board_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_user_id ON public.board_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_created_at ON public.board_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_is_pinned ON public.board_posts(is_pinned DESC);

-- Composite indices for feed queries
-- Validates efficient sorting for main feeds
CREATE INDEX IF NOT EXISTS idx_board_posts_feed_all ON public.board_posts(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_feed_group ON public.board_posts(group_id, is_pinned DESC, created_at DESC);

-- board_comments
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON public.board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_user_id ON public.board_comments(user_id);

-- group_members
-- (PK usually covers (group_id, user_id) or similar, but individual indices help joins)
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
