-- Consolidates the repo migrations 20260820*..20261121* that were never applied to production,
-- adapted to the live schema (reconcile_tutoring_schema already applied appointments/teacher_profiles RLS).
-- Already applied to production (version 20261127054228).

-- ===================== feedback =====================
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Feedback submitter owns submitted record" ON public.feedback;
DROP POLICY IF EXISTS "Guests submit unlinked feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users submit own feedback" ON public.feedback;

CREATE POLICY "Guests submit unlinked feedback" ON public.feedback
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Users submit own feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DO $feedback_status_check$
BEGIN
  IF EXISTS (SELECT 1 FROM public.feedback
             WHERE status IS NULL OR status NOT IN ('open','in_review','resolved','dismissed')) THEN
    RAISE EXCEPTION 'Feedback migration blocked: existing rows contain unsupported status values';
  END IF;
END;
$feedback_status_check$;

CREATE INDEX IF NOT EXISTS feedback_status_created_at_idx ON public.feedback (status, created_at DESC);

-- ===================== documents bucket + policies =====================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents','documents',false,20971520,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 20971520;

DROP POLICY IF EXISTS "docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_select_visible" ON storage.objects;
DROP POLICY IF EXISTS "docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_delete_own" ON storage.objects;

CREATE POLICY "docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "docs_select_visible" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.owner_id = (SELECT auth.uid())
        OR d.visibility = 'public'
        OR (d.visibility = 'students' AND EXISTS (
              SELECT 1 FROM public.appointments a
              WHERE a.teacher_id = d.owner_id AND a.student_id = (SELECT auth.uid())
                AND a.status IN ('confirmed','completed')))
      )
  )
);

CREATE POLICY "docs_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "doc_select_visible" ON public.documents;
CREATE POLICY "doc_select_visible" ON public.documents FOR SELECT TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR visibility = 'public'
  OR (visibility = 'students' AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.teacher_id = documents.owner_id AND a.student_id = (SELECT auth.uid())
          AND a.status IN ('confirmed','completed')))
);

CREATE OR REPLACE FUNCTION public.guard_document_object_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT public.is_mod_or_admin(auth.uid()) AND NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.file_path IS DISTINCT FROM OLD.file_path OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_type IS DISTINCT FROM OLD.file_type
       OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Document ownership and storage identity are immutable';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_document_object_identity ON public.documents;
CREATE TRIGGER trg_guard_document_object_identity BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_object_identity();

-- ===================== teacher_schools =====================
DROP POLICY IF EXISTS "Teachers request to join" ON public.teacher_schools;
CREATE POLICY "Teachers request to join" ON public.teacher_schools FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = teacher_id AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.account_type = 'teacher')
);

DROP POLICY IF EXISTS "School admin or teacher updates" ON public.teacher_schools;
DROP POLICY IF EXISTS "School admins moderate memberships" ON public.teacher_schools;
CREATE POLICY "School admins moderate memberships" ON public.teacher_schools FOR UPDATE TO authenticated
USING (
  public.is_mod_or_admin((SELECT auth.uid())) OR public.is_super_admin((SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.schools s WHERE s.id = teacher_schools.school_id AND s.admin_id = (SELECT auth.uid()))
)
WITH CHECK (
  public.is_mod_or_admin((SELECT auth.uid())) OR public.is_super_admin((SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.schools s WHERE s.id = teacher_schools.school_id AND s.admin_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.guard_teacher_school_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Teacher-school membership identity fields are immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_teacher_school_identity ON public.teacher_schools;
CREATE TRIGGER trg_guard_teacher_school_identity BEFORE UPDATE ON public.teacher_schools
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_school_identity();

-- ===================== custom_options RPC (calls policy already host-only live) =====================
DROP POLICY IF EXISTS "Authenticated can bump usage" ON public.custom_options;
REVOKE UPDATE ON public.custom_options FROM authenticated;

CREATE OR REPLACE FUNCTION public.record_custom_option(p_category text, p_value text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category text := btrim(COALESCE(p_category, ''));
  v_value text := btrim(COALESCE(p_value, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(v_category) < 1 OR length(v_category) > 80 THEN RAISE EXCEPTION 'Category must contain between 1 and 80 characters'; END IF;
  IF length(v_value) < 1 OR length(v_value) > 120 THEN RAISE EXCEPTION 'Option must contain between 1 and 120 characters'; END IF;
  INSERT INTO public.custom_options (category, value, created_by, usage_count)
  VALUES (v_category, v_value, auth.uid(), 1)
  ON CONFLICT (category, value) DO UPDATE SET usage_count = public.custom_options.usage_count + 1;
  RETURN v_value;
END; $$;
REVOKE ALL ON FUNCTION public.record_custom_option(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_custom_option(text, text) TO authenticated;

-- ===================== signup: never trust account_type from client metadata =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username text; v_display text; v_account_type public.account_type;
  v_school text; v_grade text; v_subject text;
BEGIN
  v_username := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'username'), ''),
                         split_part(COALESCE(NEW.email, ''), '@', 1));
  v_display := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
                        NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), v_username);
  -- Only student/teacher may be self-selected at signup. Administrator is never accepted.
  v_account_type := CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'teacher'
                         THEN 'teacher'::public.account_type ELSE 'student'::public.account_type END;
  v_school := NULLIF(btrim(NEW.raw_user_meta_data->>'school'), '');
  v_grade := NULLIF(btrim(NEW.raw_user_meta_data->>'grade'), '');
  v_subject := NULLIF(btrim(NEW.raw_user_meta_data->>'subject'), '');

  BEGIN
    INSERT INTO public.profiles (id, username, display_name, full_name, account_type, school, grade, subjects, points)
    VALUES (NEW.id, v_username, v_display, v_display, v_account_type, v_school, v_grade,
            CASE WHEN v_subject IS NULL THEN '{}'::text[] ELSE ARRAY[v_subject] END, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Username already taken: retry with a unique suffix instead of failing the signup.
    INSERT INTO public.profiles (id, username, display_name, full_name, account_type, school, grade, subjects, points)
    VALUES (NEW.id, v_username || substr(NEW.id::text, 1, 4), v_display, v_display, v_account_type, v_school, v_grade,
            CASE WHEN v_subject IS NULL THEN '{}'::text[] ELSE ARRAY[v_subject] END, 0)
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

-- ===================== profile self-edit guard =====================
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())) THEN
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      -- Onboarding lets a new user pick student or teacher exactly once; never administrator.
      IF NOT (COALESCE(OLD.has_completed_onboarding, false) = false
              AND NEW.account_type IN ('student'::public.account_type, 'teacher'::public.account_type)) THEN
        RAISE EXCEPTION 'Account type changes must be handled by an administrator';
      END IF;
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.points IS DISTINCT FROM OLD.points
       OR NEW.lesson_count IS DISTINCT FROM OLD.lesson_count
       OR NEW.fork_received_count IS DISTINCT FROM OLD.fork_received_count
       OR NEW.follower_count IS DISTINCT FROM OLD.follower_count
       OR NEW.following_count IS DISTINCT FROM OLD.following_count
       OR NEW.xp IS DISTINCT FROM OLD.xp
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.streak_days IS DISTINCT FROM OLD.streak_days THEN
      RAISE EXCEPTION 'Verification and achievement fields are managed by Leatha';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR public.is_super_admin((SELECT auth.uid())))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin') OR public.is_super_admin((SELECT auth.uid())));

-- ===================== teacher aggregate guard =====================
CREATE OR REPLACE FUNCTION public.guard_teacher_profile_aggregates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.rating_avg IS DISTINCT FROM 0::numeric OR NEW.rating_count IS DISTINCT FROM 0
         OR NEW.students_count IS DISTINCT FROM 0 OR NEW.total_earnings_cents IS DISTINCT FROM 0::bigint
         OR NEW.total_earnings IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'Teacher reputation and earnings are calculated by Leatha';
      END IF;
    ELSE
      IF NEW.rating_avg IS DISTINCT FROM OLD.rating_avg OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
         OR NEW.students_count IS DISTINCT FROM OLD.students_count
         OR NEW.total_earnings_cents IS DISTINCT FROM OLD.total_earnings_cents
         OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings THEN
        RAISE EXCEPTION 'Teacher reputation and earnings are calculated by Leatha';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_teacher_profile_aggregates ON public.teacher_profiles;
CREATE TRIGGER trg_guard_teacher_profile_aggregates BEFORE INSERT OR UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_aggregates();

-- Backfill teacher_profiles rows for existing teacher accounts (existing rows untouched).
INSERT INTO public.teacher_profiles (user_id, subjects, years_experience)
SELECT p.id, COALESCE(p.subjects, '{}'::text[]),
  CASE WHEN p.experience = '1-5 years' THEN 1 WHEN p.experience = '6-10 years' THEN 6
       WHEN p.experience = '10+ years' THEN 10 ELSE 0 END
FROM public.profiles p WHERE p.account_type = 'teacher'
ON CONFLICT (user_id) DO NOTHING;

-- ===================== privileged role mutation guard =====================
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_is_super_admin boolean := false; super_admin_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN COALESCE(NEW, OLD); END IF;
  actor_is_super_admin := public.is_super_admin(auth.uid());
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('admin','super_admin') AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can grant privileged roles'; END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.role IN ('admin','super_admin') OR NEW.role IN ('admin','super_admin')) AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can modify privileged roles'; END IF;
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      SELECT count(*) INTO super_admin_count FROM public.user_roles WHERE role = 'super_admin';
      IF super_admin_count <= 1 THEN RAISE EXCEPTION 'The final super administrator cannot be demoted'; END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role IN ('admin','super_admin') AND NOT actor_is_super_admin THEN
      RAISE EXCEPTION 'Only the protected super administrator can remove privileged roles'; END IF;
    IF OLD.role = 'super_admin' THEN
      SELECT count(*) INTO super_admin_count FROM public.user_roles WHERE role = 'super_admin';
      IF super_admin_count <= 1 THEN RAISE EXCEPTION 'The final super administrator cannot be removed'; END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS protect_super_admin ON public.user_roles;
CREATE TRIGGER protect_super_admin BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('moderator','admin','super_admin'))
$$;

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR public.is_super_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR public.is_super_admin((SELECT auth.uid())))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin') OR public.is_super_admin((SELECT auth.uid())));

-- ===================== blocked-user DM protection =====================
CREATE OR REPLACE FUNCTION public.can_interact_with_user(_other_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND _other_user_id IS NOT NULL AND _other_user_id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _other_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = _other_user_id)
         OR (b.blocker_id = _other_user_id AND b.blocked_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.can_interact_with_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_interact_with_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users send DMs" ON public.direct_messages;
CREATE POLICY "Users send DMs" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = sender_id AND public.can_interact_with_user(recipient_id));

-- ===================== support tickets: restore submissions (reconcile left no INSERT policy) =====================
REVOKE INSERT ON TABLE public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, email, subject, message) ON TABLE public.support_tickets TO anon, authenticated;
DROP POLICY IF EXISTS "Anyone can submit ticket" ON public.support_tickets;
DROP POLICY IF EXISTS "Guests submit unlinked tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users submit own tickets" ON public.support_tickets;
CREATE POLICY "Guests submit unlinked tickets" ON public.support_tickets FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Users submit own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ===================== lock trigger-only SECURITY DEFINER functions out of the REST API =====================
-- Trigger functions do not need EXECUTE at fire time; this removes them from /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION
  public.enforce_appointment_update(), public.ensure_arena_profile(),
  public.notify_teacher_on_appointment_created(), public.on_appointment_change(),
  public.on_comment_change(), public.on_follow_change(), public.on_lesson_delete(),
  public.on_lesson_insert(), public.on_lesson_view_insert(), public.on_like_change(),
  public.on_suggestion_upvote_change(), public.on_suggestion_view_insert(),
  public.promote_first_user_to_admin(), public.protect_super_admin_role(),
  public.handle_new_user(), public.recompute_teacher_rating()
FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
