CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_exists boolean;
  acting_uid uuid := auth.uid();
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO super_exists;

  -- Bootstrap: if no super_admin yet, allow inserts (first user becomes admin/super_admin).
  IF NOT super_exists AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- DELETE: only super admin can remove admin or super_admin rows.
  IF TG_OP = 'DELETE' AND OLD.role IN ('admin','super_admin') THEN
    IF NOT public.is_super_admin(acting_uid) THEN
      RAISE EXCEPTION 'Only the master admin can revoke admin or master-admin roles';
    END IF;
  END IF;

  -- INSERT: only super admin can grant admin or super_admin.
  IF TG_OP = 'INSERT' AND NEW.role IN ('admin','super_admin') THEN
    IF NOT public.is_super_admin(acting_uid) THEN
      RAISE EXCEPTION 'Only the master admin can grant admin or master-admin roles';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin ON public.user_roles;
CREATE TRIGGER protect_super_admin
BEFORE INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();