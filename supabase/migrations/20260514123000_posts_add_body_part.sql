-- Add body_part column to posts table for exercise category filtering
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS body_part text;
