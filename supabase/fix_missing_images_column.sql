-- Fix for "Could not find the 'images' column" error
-- Run this in Supabase SQL Editor

alter table public.board_posts 
add column if not exists images text[];
