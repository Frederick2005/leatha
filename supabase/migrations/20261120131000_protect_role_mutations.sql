-- Protect privileged role rows against ordinary administrator mutation.
-- Existing first-user bootstrap remains possible because its trigger executes
-- under its SECURITY DEFINER owner, not as the browser's authenticated role.
-- Creating/promoting a super_admin is reserved for trusted service/database
-- administration until the platform owner is explicitly designated.

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_super_admin boolean := false;
  super_admin_count integer := 0;
BEGIN
  -- Trusted server-side maintenance and SECURITY DEFINER bootstrap functions
  -- are not ordinary browser role mutations.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  actor_is_super_admin := public.is_super_admin(auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('admin', 'super_admin') AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can grant privileged roles';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.role IN ('admin', 'super_admin') OR NEW.role IN ('admin', 'super_admin'))
       AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can modify privileged roles';
    END IF;

    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      SELECT count(*) INTO super_admin_count
      FROM public.user_roles
      WHERE role = 'super_admin';
      IF super_admin_count <= 1 THEN
        RAISE EXCEPTION 'The final super administrator cannot be demoted';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role IN ('admin', 'super_admin') AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can remove privileged roles';
    END IF;

    IF OLD.role = 'super_admin' THEN
      SELECT count(*) INTO super_admin_count
      FROM public.user_roles
      WHERE role = 'super_admin';
      IF super_admin_count <= 1 THEN
        RAISE EXCEPTION 'The final super administrator cannot be removed';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin ON public.user_roles;
CREATE TRIGGER protect_super_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- A super_admin is also a platform-level moderator/admin for RLS checks.
CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('moderator', 'admin', 'super_admin')
  )
$$;

-- Ensure a super_admin can see and administer role records even if it does not
-- separately carry the ordinary 'admin' role.
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.is_super_admin(auth.uid())
);
