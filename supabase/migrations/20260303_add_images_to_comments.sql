-- Add images column to board_comments table for attached files
ALTER TABLE public.board_comments
ADD COLUMN images text[] DEFAULT ARRAY[]::text[];
