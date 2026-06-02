
-- LESSON SUGGESTIONS
CREATE TABLE public.lesson_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  subject text NOT NULL,
  suggested_by uuid NOT NULL,
  upvote_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  claimed_by uuid,
  claimed_at timestamptz,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lesson_suggestions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_suggestions TO authenticated;
GRANT ALL ON public.lesson_suggestions TO service_role;
ALTER TABLE public.lesson_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suggestions viewable by all" ON public.lesson_suggestions FOR SELECT USING (true);
CREATE POLICY "Authed users create suggestions" ON public.lesson_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = suggested_by);
CREATE POLICY "Owner or mod updates suggestion" ON public.lesson_suggestions FOR UPDATE TO authenticated USING (auth.uid() = suggested_by OR auth.uid() = claimed_by OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "Admin deletes suggestion" ON public.lesson_suggestions FOR DELETE TO authenticated USING (public.is_mod_or_admin(auth.uid()));
CREATE INDEX idx_suggestions_status ON public.lesson_suggestions(status);
CREATE INDEX idx_suggestions_subject ON public.lesson_suggestions(subject);
CREATE INDEX idx_suggestions_upvotes ON public.lesson_suggestions(upvote_count DESC);

-- SUGGESTION UPVOTES
CREATE TABLE public.suggestion_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.lesson_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);
GRANT SELECT ON public.suggestion_upvotes TO anon;
GRANT SELECT, INSERT, DELETE ON public.suggestion_upvotes TO authenticated;
GRANT ALL ON public.suggestion_upvotes TO service_role;
ALTER TABLE public.suggestion_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Upvotes viewable by all" ON public.suggestion_upvotes FOR SELECT USING (true);
CREATE POLICY "Users upvote" ON public.suggestion_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own upvote" ON public.suggestion_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SUGGESTION VIEWS
CREATE TABLE public.suggestion_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.lesson_suggestions(id) ON DELETE CASCADE,
  user_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);
GRANT SELECT, INSERT ON public.suggestion_views TO authenticated;
GRANT ALL ON public.suggestion_views TO service_role;
ALTER TABLE public.suggestion_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own view" ON public.suggestion_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own views" ON public.suggestion_views FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));

-- COUNTER TRIGGERS
CREATE OR REPLACE FUNCTION public.on_suggestion_upvote_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lesson_suggestions SET upvote_count = upvote_count + 1, updated_at = now() WHERE id = NEW.suggestion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lesson_suggestions SET upvote_count = GREATEST(upvote_count - 1, 0), updated_at = now() WHERE id = OLD.suggestion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_suggestion_upvote_change AFTER INSERT OR DELETE ON public.suggestion_upvotes FOR EACH ROW EXECUTE FUNCTION public.on_suggestion_upvote_change();

CREATE OR REPLACE FUNCTION public.on_suggestion_view_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.lesson_suggestions SET view_count = view_count + 1 WHERE id = NEW.suggestion_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_suggestion_view_insert AFTER INSERT ON public.suggestion_views FOR EACH ROW EXECUTE FUNCTION public.on_suggestion_view_insert();

CREATE TRIGGER trg_suggestions_updated_at BEFORE UPDATE ON public.lesson_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ANALYTICS EVENTS ENHANCEMENTS
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS event_data jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON public.analytics_events(created_at DESC);

-- PROFILES ENHANCEMENTS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_subjects text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS learning_style text,
  ADD COLUMN IF NOT EXISTS study_goal text,
  ADD COLUMN IF NOT EXISTS weekly_lesson_target integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weekly_challenge_target integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS profile_updated_at ON public.profiles;
CREATE TRIGGER profile_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LESSONS view_count
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- BOOKMARKS
CREATE TABLE public.bookmarks (
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookmarks" ON public.bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bookmarks" ON public.bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- LESSON VIEWS
CREATE TABLE public.lesson_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  scroll_depth_percent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lesson_views TO authenticated;
GRANT ALL ON public.lesson_views TO service_role;
ALTER TABLE public.lesson_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own lesson view" ON public.lesson_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Lesson author or mod views analytics" ON public.lesson_views FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_views.lesson_id AND l.author_id = auth.uid())
  OR public.is_mod_or_admin(auth.uid())
);
CREATE INDEX idx_lesson_views_lesson ON public.lesson_views(lesson_id);

CREATE OR REPLACE FUNCTION public.on_lesson_view_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.lessons SET view_count = view_count + 1 WHERE id = NEW.lesson_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lesson_view_insert AFTER INSERT ON public.lesson_views FOR EACH ROW EXECUTE FUNCTION public.on_lesson_view_insert();

-- CLASS GROUPS (no policy referencing memberships yet)
CREATE TABLE public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_groups TO authenticated;
GRANT ALL ON public.class_groups TO service_role;
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_class_groups_updated_at BEFORE UPDATE ON public.class_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLASS MEMBERSHIPS
CREATE TABLE public.class_memberships (
  class_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.class_memberships TO authenticated;
GRANT ALL ON public.class_memberships TO service_role;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members and teacher view memberships" ON public.class_memberships FOR SELECT TO authenticated USING (
  auth.uid() = student_id
  OR EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_memberships.class_id AND c.teacher_id = auth.uid())
);
CREATE POLICY "Teacher adds students" ON public.class_memberships FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_memberships.class_id AND c.teacher_id = auth.uid())
);
CREATE POLICY "Teacher or student removes membership" ON public.class_memberships FOR DELETE TO authenticated USING (
  auth.uid() = student_id
  OR EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_memberships.class_id AND c.teacher_id = auth.uid())
);

-- CLASS GROUPS policies (now that memberships exists)
CREATE POLICY "Teacher manages own classes" ON public.class_groups FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Members view classes" ON public.class_groups FOR SELECT TO authenticated USING (
  auth.uid() = teacher_id
  OR EXISTS (SELECT 1 FROM public.class_memberships cm WHERE cm.class_id = class_groups.id AND cm.student_id = auth.uid())
);

-- CLASS ASSIGNMENTS
CREATE TABLE public.class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT ALL ON public.class_assignments TO service_role;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class members view assignments" ON public.class_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_assignments.class_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.class_memberships cm WHERE cm.class_id = class_assignments.class_id AND cm.student_id = auth.uid())
);
CREATE POLICY "Teacher manages assignments" ON public.class_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_assignments.class_id AND c.teacher_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.class_groups c WHERE c.id = class_assignments.class_id AND c.teacher_id = auth.uid())
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
