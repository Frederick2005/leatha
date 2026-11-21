-- Reconcile the feedback table created by the earlier message/contact migration
-- with the fields used by the current feedback and administration workflows.
-- This migration is additive: it preserves existing messages and records.

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- Remove legacy INSERT policies. Permissive policies combine with OR.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Feedback submitter owns submitted record" ON public.feedback;
DROP POLICY IF EXISTS "Guests submit unlinked feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users submit own feedback" ON public.feedback;

CREATE POLICY "Guests submit unlinked feedback"
ON public.feedback
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Users submit own feedback"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- Fail safely rather than silently changing historical status values.
DO $feedback_status_check$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.feedback
    WHERE status IS NULL
       OR status NOT IN ('open', 'in_review', 'resolved', 'dismissed')
  ) THEN
    RAISE EXCEPTION
      'Feedback migration blocked: existing rows contain unsupported status values';
  END IF;
END;
$feedback_status_check$;



CREATE INDEX IF NOT EXISTS feedback_status_created_at_idx
  ON public.feedback (status, created_at DESC);
