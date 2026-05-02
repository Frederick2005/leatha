
-- Feedback enhancements
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid;

-- Allow mods/admins to view all feedback (already covered by existing policy via OR is_mod_or_admin) — ensure UPDATE works for mods
DROP POLICY IF EXISTS "Mods view all feedback" ON public.feedback;
CREATE POLICY "Mods view all feedback"
  ON public.feedback FOR SELECT
  USING (public.is_mod_or_admin(auth.uid()));

-- Admin logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods view admin logs"
  ON public.admin_logs FOR SELECT
  USING (public.is_mod_or_admin(auth.uid()));

CREATE POLICY "Mods insert admin logs"
  ON public.admin_logs FOR INSERT
  WITH CHECK (public.is_mod_or_admin(auth.uid()) AND auth.uid() = admin_id);

CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON public.admin_logs(created_at DESC);

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements viewable by all"
  ON public.announcements FOR SELECT USING (true);

CREATE POLICY "Admins create announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = author_id);

CREATE POLICY "Admins delete announcements"
  ON public.announcements FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS announcements_created_idx ON public.announcements(created_at DESC);
