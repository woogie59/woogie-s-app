-- Add target_muscle column (slug from react-muscle-highlighter) for fine-grained anatomy filtering
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS target_muscle text;
