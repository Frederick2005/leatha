ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_body_check;
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_body_or_attachment_check
  CHECK (
    (length(body) > 0 AND length(body) <= 4000)
    OR (jsonb_array_length(COALESCE(attachments, '[]'::jsonb)) > 0)
  );