ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE public.lessons
  DROP CONSTRAINT IF EXISTS lessons_content_type_check;
ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_content_type_check
  CHECK (content_type IN ('text','video','document'));