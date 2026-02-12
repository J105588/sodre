-- Backfill scheduled_at for existing posts
-- This ensures that old posts (which have NULL scheduled_at) are treated as published at their creation time.
UPDATE board_posts 
SET scheduled_at = created_at 
WHERE scheduled_at IS NULL;
