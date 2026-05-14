-- Add video_url column to posts table for silent looping MP4 preview feature
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url text;
