-- Add attachments column to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Create public storage bucket for lesson attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-attachments', 'lesson-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated users can upload to their own folder
CREATE POLICY "Lesson attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-attachments');

CREATE POLICY "Authenticated users can upload lesson attachments to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own lesson attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own lesson attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);