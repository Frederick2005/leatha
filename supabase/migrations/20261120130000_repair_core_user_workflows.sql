-- Core workflow repairs for Leatha.
-- Additive/reversible where practical. No existing application rows are deleted.

-- ---------------------------------------------------------------------------
-- Documents: the application uses this bucket, but the migration history only
-- created its object policies. Create the private bucket if it is not present.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Enforce the intended private configuration even if the bucket was created
-- manually before this migration was added to source control.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
WHERE id = 'documents';

-- A document object's visibility follows its matching documents row. Public
-- URLs are not used: clients must request a signed URL after this policy check.
DROP POLICY IF EXISTS "docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_select_visible" ON storage.objects;
DROP POLICY IF EXISTS "docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "docs_delete_own" ON storage.objects;

CREATE POLICY "docs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "docs_select_visible"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.owner_id = auth.uid()
        OR d.visibility = 'public'
        OR (
          d.visibility = 'students'
          AND EXISTS (
            SELECT 1
            FROM public.appointments a
            WHERE a.teacher_id = d.owner_id
              AND a.student_id = auth.uid()
              AND a.status IN ('confirmed', 'completed')
          )
        )
      )
  )
);

CREATE POLICY "docs_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "docs_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Keep the document metadata visibility rule aligned with object access.
DROP POLICY IF EXISTS "doc_select_visible" ON public.documents;
CREATE POLICY "doc_select_visible"
ON public.documents FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR (
    visibility = 'students'
    AND EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.teacher_id = documents.owner_id
        AND a.student_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
  )
);

-- Users may edit document labels/visibility, but cannot repoint a public
-- metadata row at another user's private Storage object.
CREATE OR REPLACE FUNCTION public.guard_document_object_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT public.is_mod_or_admin(auth.uid())
     AND NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.file_path IS DISTINCT FROM OLD.file_path
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_type IS DISTINCT FROM OLD.file_type
       OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Document ownership and storage identity are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_document_object_identity ON public.documents;
CREATE TRIGGER trg_guard_document_object_identity
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_document_object_identity();

-- ---------------------------------------------------------------------------
-- Teacher-school membership: teachers may request membership, but must not
-- be able to approve their own request or change its school/teacher identity.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teachers request to join" ON public.teacher_schools;
CREATE POLICY "Teachers request to join"
ON public.teacher_schools FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_type = 'teacher'
  )
);

DROP POLICY IF EXISTS "School admin or teacher updates" ON public.teacher_schools;
DROP POLICY IF EXISTS "School admins moderate memberships" ON public.teacher_schools;
CREATE POLICY "School admins moderate memberships"
ON public.teacher_schools FOR UPDATE TO authenticated
USING (
  public.is_mod_or_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = teacher_schools.school_id AND s.admin_id = auth.uid()
  )
)
WITH CHECK (
  public.is_mod_or_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = teacher_schools.school_id AND s.admin_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.guard_teacher_school_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Teacher-school membership identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_teacher_school_identity ON public.teacher_schools;
CREATE TRIGGER trg_guard_teacher_school_identity
BEFORE UPDATE ON public.teacher_schools
FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_school_identity();

-- ---------------------------------------------------------------------------
-- Calls: only the call host may update call metadata/status. The old policy
-- allowed every authenticated user to update every call row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "any authed update call status" ON public.calls;
DROP POLICY IF EXISTS "calls_host_update" ON public.calls;
CREATE POLICY "calls_host_update"
ON public.calls FOR UPDATE TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- Custom options: remove unrestricted UPDATE access. A small SECURITY DEFINER
-- RPC atomically inserts a new option or increments usage for an existing one.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can bump usage" ON public.custom_options;
REVOKE UPDATE ON public.custom_options FROM authenticated;

CREATE OR REPLACE FUNCTION public.record_custom_option(p_category text, p_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text := btrim(COALESCE(p_category, ''));
  v_value text := btrim(COALESCE(p_value, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(v_category) < 1 OR length(v_category) > 80 THEN
    RAISE EXCEPTION 'Category must contain between 1 and 80 characters';
  END IF;
  IF length(v_value) < 1 OR length(v_value) > 120 THEN
    RAISE EXCEPTION 'Option must contain between 1 and 120 characters';
  END IF;

  INSERT INTO public.custom_options (category, value, created_by, usage_count)
  VALUES (v_category, v_value, auth.uid(), 1)
  ON CONFLICT (category, value)
  DO UPDATE SET usage_count = public.custom_options.usage_count + 1;

  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION public.record_custom_option(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_custom_option(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Profile/account consistency:
-- * Signup metadata is untrusted; only student/teacher may be self-selected.
-- * Persist grade/subject metadata captured by the signup form.
-- * Keep verification and reward counters server/admin controlled.
-- * Allow moderators/admins to perform the profile updates exposed in Admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_display text;
  v_account_type public.account_type;
  v_school text;
  v_grade text;
  v_subject text;
BEGIN
  v_username := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'username'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1) || substr(NEW.id::text, 1, 4)
  );
  v_display := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''), v_username);

  -- Never accept administrator privilege from public signup metadata.
  v_account_type := CASE
    WHEN NEW.raw_user_meta_data->>'account_type' = 'teacher'
      THEN 'teacher'::public.account_type
    ELSE 'student'::public.account_type
  END;
  v_school := NULLIF(btrim(NEW.raw_user_meta_data->>'school'), '');
  v_grade := NULLIF(btrim(NEW.raw_user_meta_data->>'grade'), '');
  v_subject := NULLIF(btrim(NEW.raw_user_meta_data->>'subject'), '');

  INSERT INTO public.profiles (
    id, username, display_name, account_type, school, grade, subjects
  )
  VALUES (
    NEW.id, v_username, v_display, v_account_type, v_school, v_grade,
    CASE WHEN v_subject IS NULL THEN '{}'::text[] ELSE ARRAY[v_subject] END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER business triggers (lesson/follow counters) execute as
  -- their function owner, while ordinary browser requests execute as
  -- authenticated. Only admins may change protected profile fields.
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT (public.has_role(auth.uid(), 'admin')
         OR public.is_super_admin(auth.uid())) THEN
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'Account type changes must be handled by an administrator';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
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
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Teachers may edit their own public profile, but not derived reputation or
-- earnings totals. Rating aggregation triggers run with definer privileges.
CREATE OR REPLACE FUNCTION public.guard_teacher_profile_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND auth.role() = 'authenticated'
     AND NOT (public.has_role(auth.uid(), 'admin')
         OR public.is_super_admin(auth.uid())) THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.rating_avg IS DISTINCT FROM 0::numeric
         OR NEW.rating_count IS DISTINCT FROM 0
         OR NEW.students_count IS DISTINCT FROM 0
         OR NEW.total_earnings_cents IS DISTINCT FROM 0::bigint THEN
        RAISE EXCEPTION 'Teacher reputation and earnings are calculated by Leatha';
      END IF;
    ELSE
      IF NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
         OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
         OR NEW.students_count IS DISTINCT FROM OLD.students_count
         OR NEW.total_earnings_cents IS DISTINCT FROM OLD.total_earnings_cents THEN
        RAISE EXCEPTION 'Teacher reputation and earnings are calculated by Leatha';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_teacher_profile_aggregates ON public.teacher_profiles;
CREATE TRIGGER trg_guard_teacher_profile_aggregates
BEFORE INSERT OR UPDATE ON public.teacher_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_aggregates();

-- Backfill teacher_profiles for legacy teacher accounts created before the
-- dedicated teacher profile workflow existed. Existing teacher profile rows
-- and their rates/settings are left untouched.
INSERT INTO public.teacher_profiles (user_id, subjects, years_experience)
SELECT
  p.id,
  COALESCE(p.subjects, '{}'::text[]),
  CASE
    WHEN p.experience = '1-5 years' THEN 1
    WHEN p.experience = '6-10 years' THEN 6
    WHEN p.experience = '10+ years' THEN 10
    ELSE 0
  END
FROM public.profiles p
WHERE p.account_type = 'teacher'
ON CONFLICT (user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
