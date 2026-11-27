-- From repo migration 20260820120000: keep invite_links.use_count in sync atomically.
-- Already applied to production (version 20261127054349).
CREATE OR REPLACE FUNCTION public.bump_invite_use_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.invite_links SET use_count = use_count + 1 WHERE code = NEW.invite_code;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_invite_use_count ON public.invite_uses;
CREATE TRIGGER trg_bump_invite_use_count AFTER INSERT ON public.invite_uses
  FOR EACH ROW EXECUTE FUNCTION public.bump_invite_use_count();

REVOKE EXECUTE ON FUNCTION public.bump_invite_use_count() FROM PUBLIC, anon, authenticated;
