-- Add target_muscles (array of micro-segment IDs) for multi-select muscle targeting.
-- target_muscle (single slug) is kept for backward compatibility with existing posts.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS target_muscles text[] DEFAULT NULL;

-- Back-fill: any post with a target_muscle gets it wrapped into the array.
UPDATE public.posts
  SET target_muscles = ARRAY[target_muscle]
  WHERE target_muscle IS NOT NULL
    AND (target_muscles IS NULL OR array_length(target_muscles, 1) = 0);
