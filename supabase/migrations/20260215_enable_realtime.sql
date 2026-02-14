-- Enable Realtime for board_posts and board_comments
-- This is necessary for supabase.channel().on('postgres_changes') to work

-- 1. Check if publication exists (supabase_realtime is default)
-- But we can't conditionally create in simple SQL script easily, assume it exists or try to alter.
-- Supabase usually has 'supabase_realtime' publication enabled by default.

-- 2. Add tables to publication
begin;
  -- Try to drop first to avoid duplicate errors if possible, or just add.
  -- Simpler to just alter. If already added, it might throw error or be no-op.
  -- Safest way is to remove then add, or ignore error.
  
  -- However, "alter publication ... add table" is idempotent in some PG versions but let's be explicit.
  
  -- We'll enable REPLICA IDENTITY FULL for these tables to ensure we get data (optional but good for realtime)
  ALTER TABLE public.board_posts REPLICA IDENTITY FULL;
  ALTER TABLE public.board_comments REPLICA IDENTITY FULL;

  -- Add to supabase_realtime
  -- We wrap in dynamic SQL to avoid breaking if publication doesn't exist (though it should)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'board_posts') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'board_comments') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.board_comments;
    END IF;
  END
  $$;
commit;
