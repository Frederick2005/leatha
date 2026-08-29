-- Fix backend/frontend contract mismatches:
-- The frontend (src/lib/ratingClient.ts, supabase/functions/process-rating-event,
-- src/routes/auth.tsx, src/routes/join.tsx) queries these four tables, but none
-- of them were ever created in a prior migration. Every call against them
-- currently fails at runtime (PostgREST "relation does not exist").

-- ============================================================
-- CREATOR RATING STATE (read by ratingClient.getCreatorRating,
-- written only by the process-rating-event edge function via service role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creator_rating_state (
  creator_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dqi_x NUMERIC NOT NULL DEFAULT 0,
  lis_total NUMERIC NOT NULL DEFAULT 0,
  active_lis NUMERIC NOT NULL DEFAULT 0,
  engine_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_rating_state TO anon, authenticated;
GRANT ALL ON public.creator_rating_state TO service_role;
ALTER TABLE public.creator_rating_state ENABLE ROW LEVEL SECURITY;
-- Ratings are public (shown on creator profiles); only the service-role
-- edge function may write, so there are intentionally no INSERT/UPDATE/DELETE
-- policies for anon/authenticated.
CREATE POLICY "creator_rating_state_select_all" ON public.creator_rating_state
  FOR SELECT USING (true);

-- ============================================================
-- RATING EVENTS (append-only log written by process-rating-event edge function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rating_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  quality_value NUMERIC NOT NULL,
  trust_tau NUMERIC,
  dqi_after NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rating_events_creator ON public.rating_events(creator_id, created_at DESC);
GRANT ALL ON public.rating_events TO service_role;
ALTER TABLE public.rating_events ENABLE ROW LEVEL SECURITY;
-- Written only by the edge function (service role bypasses RLS). No
-- anon/authenticated policies -> the raw event log is not client-readable,
-- only the aggregated creator_rating_state is.
CREATE POLICY "rating_events_owner_select" ON public.rating_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- ============================================================
-- INVITE LINKS (read anonymously by /join to validate a code)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invite_links (
  code TEXT PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invite_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invite_links TO authenticated;
GRANT ALL ON public.invite_links TO service_role;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
-- join.tsx does an anonymous `.select("code")...eq("code", ref)` before login,
-- so SELECT must be open. Only expose active, unexpired links.
CREATE POLICY "invite_links_select_active" ON public.invite_links
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "invite_links_insert_own" ON public.invite_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "invite_links_update_own" ON public.invite_links
  FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "invite_links_delete_own" ON public.invite_links
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- ============================================================
-- INVITE USES (auth.tsx upserts one row per (invite_code, used_by) after signup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invite_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL REFERENCES public.invite_links(code) ON DELETE CASCADE,
  used_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invite_code, used_by)
);
CREATE INDEX IF NOT EXISTS idx_invite_uses_code ON public.invite_uses(invite_code);
GRANT SELECT, INSERT ON public.invite_uses TO authenticated;
GRANT ALL ON public.invite_uses TO service_role;
ALTER TABLE public.invite_uses ENABLE ROW LEVEL SECURITY;
-- A user may only ever record their OWN use of a code (auth.tsx sets
-- used_by = the newly-signed-up user's own id) - never someone else's.
CREATE POLICY "invite_uses_insert_self" ON public.invite_uses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = used_by);
-- Link owner can see who used their link; a user can see their own uses.
CREATE POLICY "invite_uses_select_owner_or_self" ON public.invite_uses
  FOR SELECT TO authenticated USING (
    auth.uid() = used_by
    OR EXISTS (
      SELECT 1 FROM public.invite_links il
      WHERE il.code = invite_uses.invite_code AND il.created_by = auth.uid()
    )
  );

-- Keep invite_links.use_count in sync atomically instead of trusting the
-- client to increment it (client never writes use_count directly - see above).
CREATE OR REPLACE FUNCTION public.bump_invite_use_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invite_links
    SET use_count = use_count + 1
    WHERE code = NEW.invite_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invite_use_count ON public.invite_uses;
CREATE TRIGGER trg_bump_invite_use_count
  AFTER INSERT ON public.invite_uses
  FOR EACH ROW EXECUTE FUNCTION public.bump_invite_use_count();
