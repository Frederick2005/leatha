-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE public.report_target_type AS ENUM ('lesson', 'comment', 'chat_message', 'user', 'direct_message');

-- =========================================================
-- UTILITY: updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  theme TEXT NOT NULL DEFAULT 'blue',
  dark_mode BOOLEAN NOT NULL DEFAULT true,
  points INTEGER NOT NULL DEFAULT 0,
  lesson_count INTEGER NOT NULL DEFAULT 0,
  fork_received_count INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table - prevents privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('moderator', 'admin')
  )
$$;

-- =========================================================
-- LESSONS
-- =========================================================
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  language TEXT,
  parent_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  root_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  fork_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(author_id, slug)
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lessons_author ON public.lessons(author_id);
CREATE INDEX idx_lessons_parent ON public.lessons(parent_lesson_id);
CREATE INDEX idx_lessons_root ON public.lessons(root_lesson_id);
CREATE INDEX idx_lessons_created ON public.lessons(created_at DESC);
CREATE INDEX idx_lessons_tags ON public.lessons USING GIN(tags);
CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lesson contributors (forks list original author as contributor)
CREATE TABLE public.lesson_contributors (
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, user_id)
);
ALTER TABLE public.lesson_contributors ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- FOLLOWS
-- =========================================================
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_follows_followee ON public.follows(followee_id);

-- =========================================================
-- LIKES
-- =========================================================
CREATE TABLE public.lesson_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
ALTER TABLE public.lesson_likes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lesson_likes_lesson ON public.lesson_likes(lesson_id);

-- =========================================================
-- COMMENTS
-- =========================================================
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_lesson ON public.comments(lesson_id, created_at DESC);
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CHAT (public global room)
-- =========================================================
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_chat_created ON public.chat_messages(created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- =========================================================
-- DIRECT MESSAGES
-- =========================================================
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dm_pair ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_dm_recipient ON public.direct_messages(recipient_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;

-- =========================================================
-- BLOCKS
-- =========================================================
CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- REPORTS
-- =========================================================
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) > 0 AND length(reason) <= 1000),
  status public.report_status NOT NULL DEFAULT 'pending',
  resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REWARDS LEDGER
-- =========================================================
CREATE TABLE public.rewards_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rewards_user ON public.rewards_log(user_id, created_at DESC);

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- lessons
CREATE POLICY "Published lessons viewable by all" ON public.lessons FOR SELECT
  USING (is_published = true OR auth.uid() = author_id OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "Authenticated users create lessons" ON public.lessons FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own lessons" ON public.lessons FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors or admins delete lessons" ON public.lessons FOR DELETE
  USING (auth.uid() = author_id OR public.is_mod_or_admin(auth.uid()));

-- lesson_contributors
CREATE POLICY "Contributors viewable by all" ON public.lesson_contributors FOR SELECT USING (true);
CREATE POLICY "Lesson author manages contributors" ON public.lesson_contributors FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.author_id = auth.uid()));

-- follows
CREATE POLICY "Follows viewable by all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users create own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users delete own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- lesson_likes
CREATE POLICY "Likes viewable by all" ON public.lesson_likes FOR SELECT USING (true);
CREATE POLICY "Users create own likes" ON public.lesson_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON public.lesson_likes FOR DELETE USING (auth.uid() = user_id);

-- comments
CREATE POLICY "Comments viewable by all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users create comments" ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors or mods delete comments" ON public.comments FOR DELETE
  USING (auth.uid() = author_id OR public.is_mod_or_admin(auth.uid()));

-- chat_messages
CREATE POLICY "Chat viewable by all" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users post chat" ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors or mods delete chat" ON public.chat_messages FOR DELETE
  USING (auth.uid() = author_id OR public.is_mod_or_admin(auth.uid()));

-- direct_messages
CREATE POLICY "DMs viewable by participants" ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send DMs" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipient marks read" ON public.direct_messages FOR UPDATE USING (auth.uid() = recipient_id);

-- blocks
CREATE POLICY "Users view own blocks" ON public.blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users create own blocks" ON public.blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON public.blocks FOR DELETE USING (auth.uid() = blocker_id);

-- reports
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Mods view all reports" ON public.reports FOR SELECT USING (public.is_mod_or_admin(auth.uid()));
CREATE POLICY "Authenticated users create reports" ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Mods update reports" ON public.reports FOR UPDATE USING (public.is_mod_or_admin(auth.uid()));

-- rewards_log
CREATE POLICY "Users view own rewards" ON public.rewards_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mods view all rewards" ON public.rewards_log FOR SELECT USING (public.is_mod_or_admin(auth.uid()));

-- =========================================================
-- TRIGGER: auto-create profile + user role on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(NEW.id::text, 1, 4)
  );
  v_display := COALESCE(NEW.raw_user_meta_data->>'display_name', v_username);

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, v_username, v_display)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- TRIGGERS: counters and rewards
-- =========================================================

-- Lesson published -> +10 points, increment author lesson_count
CREATE OR REPLACE FUNCTION public.on_lesson_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add author as contributor
  INSERT INTO public.lesson_contributors (lesson_id, user_id)
  VALUES (NEW.id, NEW.author_id)
  ON CONFLICT DO NOTHING;

  -- Set root_lesson_id if this is a fork
  IF NEW.parent_lesson_id IS NOT NULL AND NEW.root_lesson_id IS NULL THEN
    UPDATE public.lessons SET root_lesson_id = COALESCE(
      (SELECT root_lesson_id FROM public.lessons WHERE id = NEW.parent_lesson_id),
      NEW.parent_lesson_id
    ) WHERE id = NEW.id;
  END IF;

  -- Increment author lesson count
  UPDATE public.profiles SET lesson_count = lesson_count + 1 WHERE id = NEW.author_id;

  -- Reward author for publishing
  IF NEW.is_published THEN
    UPDATE public.profiles SET points = points + 10 WHERE id = NEW.author_id;
    INSERT INTO public.rewards_log (user_id, points, reason, related_id)
    VALUES (NEW.author_id, 10, 'lesson_published', NEW.id);
  END IF;

  -- If this is a fork, reward parent author and bump fork counts
  IF NEW.parent_lesson_id IS NOT NULL THEN
    UPDATE public.lessons SET fork_count = fork_count + 1 WHERE id = NEW.parent_lesson_id;
    UPDATE public.profiles
      SET fork_received_count = fork_received_count + 1,
          points = points + 5
      FROM public.lessons l
      WHERE l.id = NEW.parent_lesson_id AND profiles.id = l.author_id;
    INSERT INTO public.rewards_log (user_id, points, reason, related_id)
    SELECT l.author_id, 5, 'lesson_forked', NEW.id
    FROM public.lessons l WHERE l.id = NEW.parent_lesson_id;

    -- Add original parent author as contributor
    INSERT INTO public.lesson_contributors (lesson_id, user_id)
    SELECT NEW.id, l.author_id FROM public.lessons l WHERE l.id = NEW.parent_lesson_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_on_lesson_insert AFTER INSERT ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.on_lesson_insert();

-- Lesson deleted -> decrement author count
CREATE OR REPLACE FUNCTION public.on_lesson_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET lesson_count = GREATEST(lesson_count - 1, 0) WHERE id = OLD.author_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_on_lesson_delete AFTER DELETE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.on_lesson_delete();

-- Follow / unfollow counters
CREATE OR REPLACE FUNCTION public.on_follow_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET follower_count = follower_count + 1 WHERE id = NEW.followee_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.followee_id;
    UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_follow_insert AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.on_follow_change();
CREATE TRIGGER trg_follow_delete AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.on_follow_change();

-- Like counters
CREATE OR REPLACE FUNCTION public.on_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lessons SET like_count = like_count + 1 WHERE id = NEW.lesson_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lessons SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.lesson_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_like_insert AFTER INSERT ON public.lesson_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_change();
CREATE TRIGGER trg_like_delete AFTER DELETE ON public.lesson_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_change();

-- Comment counters
CREATE OR REPLACE FUNCTION public.on_comment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lessons SET comment_count = comment_count + 1 WHERE id = NEW.lesson_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lessons SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.lesson_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_comment_insert AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.on_comment_change();
CREATE TRIGGER trg_comment_delete AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.on_comment_change();