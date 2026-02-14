-- Indexes for Performance Optimization
-- Based on queries in members-area.js

-- 1. board_comments foreign key (for count and fetching)
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON public.board_comments (post_id);

-- 2. board_posts filtering and sorting
-- Query uses: is('group_id', null) OR eq('group_id', gid)
-- And Sorts by: is_pinned DESC, scheduled_at DESC, created_at DESC

-- Index for Group ID (and null)
CREATE INDEX IF NOT EXISTS idx_board_posts_group_id ON public.board_posts (group_id);

-- Composite Index for Sorting
-- This generally helps with ORDER BY is_pinned, scheduled_at, created_at
CREATE INDEX IF NOT EXISTS idx_board_posts_sorting ON public.board_posts (is_pinned DESC, scheduled_at DESC, created_at DESC);

-- 3. User ID for "My Posts" filtering (used in OR condition)
CREATE INDEX IF NOT EXISTS idx_board_posts_user_id ON public.board_posts (user_id);

-- 4. Scheduled At for filtering future posts
CREATE INDEX IF NOT EXISTS idx_board_posts_scheduled_at ON public.board_posts (scheduled_at);
