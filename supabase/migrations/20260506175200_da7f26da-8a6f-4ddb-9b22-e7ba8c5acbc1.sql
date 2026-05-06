
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_level text;
