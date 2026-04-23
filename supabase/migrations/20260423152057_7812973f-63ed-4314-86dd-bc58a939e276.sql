-- Add attachments column to direct_messages
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Allow empty body when attachments are present
ALTER TABLE public.direct_messages
  ALTER COLUMN body SET DEFAULT '';

-- Create private storage bucket for DM attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-attachments',
  'dm-attachments',
  false,
  20971520, -- 20 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies. Path convention: {sender_id}/{recipient_id}/{uuid}-{filename}
-- Sender uploads into their own folder
CREATE POLICY "DM upload by sender"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dm-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only sender or recipient can read; recipient_id is the second folder segment
CREATE POLICY "DM read by participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dm-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Sender can delete their own attachments
CREATE POLICY "DM delete by sender"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dm-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);