-- Helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;

-- Schools
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schools viewable by all" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Mods create schools" ON public.schools FOR INSERT
  WITH CHECK (auth.uid() = admin_id AND public.is_mod_or_admin(auth.uid()));
CREATE POLICY "School admin updates" ON public.schools FOR UPDATE
  USING (auth.uid() = admin_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin deletes schools" ON public.schools FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Teacher ↔ School
CREATE TABLE IF NOT EXISTS public.teacher_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, school_id)
);
ALTER TABLE public.teacher_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memberships viewable by teacher or school admin"
  ON public.teacher_schools FOR SELECT USING (
    auth.uid() = teacher_id
    OR EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_id AND s.admin_id = auth.uid())
    OR public.is_mod_or_admin(auth.uid())
  );
CREATE POLICY "Teachers request to join" ON public.teacher_schools FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "School admin or teacher updates" ON public.teacher_schools FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_id AND s.admin_id = auth.uid())
    OR auth.uid() = teacher_id
  );
CREATE POLICY "Teacher or school admin deletes" ON public.teacher_schools FOR DELETE
  USING (
    auth.uid() = teacher_id
    OR EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_id AND s.admin_id = auth.uid())
  );

-- Verified flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Analytics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx
  ON public.analytics_events (event_type, created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed log events" ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR auth.uid() = user_id));
CREATE POLICY "Mods read analytics" ON public.analytics_events FOR SELECT
  USING (public.is_mod_or_admin(auth.uid()));

-- Super admin protection
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  super_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO super_exists;
  IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin') THEN
    IF NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only super admins can remove super_admin role';
    END IF;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.role IN ('admin','super_admin')) THEN
    IF super_exists AND NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only super admins can grant admin or super_admin role';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS protect_super_admin ON public.user_roles;
CREATE TRIGGER protect_super_admin BEFORE INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();