-- Enums
CREATE TYPE public.arena_challenge_type AS ENUM ('quiz','code','math','science','language','essay','logic','simulation');
CREATE TYPE public.arena_difficulty AS ENUM ('easy','medium','hard','expert');
CREATE TYPE public.arena_challenge_status AS ENUM ('draft','published','archived');
CREATE TYPE public.arena_attempt_status AS ENUM ('in_progress','passed','failed','abandoned');
CREATE TYPE public.arena_battle_mode AS ENUM ('1v1','team','classroom','survival','speedrun','boss');
CREATE TYPE public.arena_battle_state AS ENUM ('pending','live','finished','cancelled');
CREATE TYPE public.arena_reward_rarity AS ENUM ('common','rare','epic','legendary','mythic');

-- challenges
CREATE TABLE public.arena_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  type arena_challenge_type NOT NULL,
  difficulty arena_difficulty NOT NULL DEFAULT 'easy',
  tags text[] NOT NULL DEFAULT '{}',
  language text,
  starter_code text,
  test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  points_reward integer NOT NULL DEFAULT 10,
  coin_reward integer NOT NULL DEFAULT 5,
  estimated_minutes integer NOT NULL DEFAULT 5,
  linked_lesson_id uuid,
  status arena_challenge_status NOT NULL DEFAULT 'draft',
  attempt_count integer NOT NULL DEFAULT 0,
  solve_count integer NOT NULL DEFAULT 0,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_challenges TO authenticated;
GRANT ALL ON public.arena_challenges TO service_role;
ALTER TABLE public.arena_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_arena_challenges_status_diff ON public.arena_challenges(status, difficulty);
CREATE INDEX idx_arena_challenges_tags ON public.arena_challenges USING GIN(tags);
CREATE INDEX idx_arena_challenges_type ON public.arena_challenges(type);

-- quiz questions
CREATE TABLE public.arena_challenge_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_indexes integer[] NOT NULL DEFAULT '{}',
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_challenge_questions TO authenticated;
GRANT ALL ON public.arena_challenge_questions TO service_role;
ALTER TABLE public.arena_challenge_questions ENABLE ROW LEVEL SECURITY;

-- attempts
CREATE TABLE public.arena_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  status arena_attempt_status NOT NULL DEFAULT 'in_progress',
  score integer NOT NULL DEFAULT 0,
  runtime_ms integer,
  memory_kb integer,
  submitted_code text,
  submitted_answer jsonb,
  hints_used integer NOT NULL DEFAULT 0,
  tests_passed integer NOT NULL DEFAULT 0,
  tests_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_attempts TO authenticated;
GRANT ALL ON public.arena_attempts TO service_role;
ALTER TABLE public.arena_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_arena_attempts_user ON public.arena_attempts(user_id, created_at DESC);
CREATE INDEX idx_arena_attempts_challenge ON public.arena_attempts(challenge_id, status);

-- hints
CREATE TABLE public.arena_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  body text NOT NULL,
  point_penalty integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_hints TO authenticated;
GRANT ALL ON public.arena_hints TO service_role;
ALTER TABLE public.arena_hints ENABLE ROW LEVEL SECURITY;

-- comments
CREATE TABLE public.arena_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  parent_id uuid REFERENCES public.arena_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_comments TO authenticated;
GRANT ALL ON public.arena_comments TO service_role;
ALTER TABLE public.arena_comments ENABLE ROW LEVEL SECURITY;

-- reactions
CREATE TABLE public.arena_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('challenge','solution','comment')),
  target_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.arena_reactions TO authenticated;
GRANT ALL ON public.arena_reactions TO service_role;
ALTER TABLE public.arena_reactions ENABLE ROW LEVEL SECURITY;

-- shared solutions
CREATE TABLE public.arena_shared_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'My solution',
  body text NOT NULL DEFAULT '',
  language text,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_shared_solutions TO authenticated;
GRANT ALL ON public.arena_shared_solutions TO service_role;
ALTER TABLE public.arena_shared_solutions ENABLE ROW LEVEL SECURITY;

-- daily challenge
CREATE TABLE public.arena_daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date date NOT NULL UNIQUE,
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  bonus_points integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arena_daily_challenges TO authenticated;
GRANT ALL ON public.arena_daily_challenges TO service_role;
ALTER TABLE public.arena_daily_challenges ENABLE ROW LEVEL SECURITY;

-- seasons
CREATE TABLE public.arena_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  theme text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arena_seasons TO authenticated;
GRANT ALL ON public.arena_seasons TO service_role;
ALTER TABLE public.arena_seasons ENABLE ROW LEVEL SECURITY;

-- arena profiles
CREATE TABLE public.arena_profiles (
  user_id uuid PRIMARY KEY,
  xp integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  reputation integer NOT NULL DEFAULT 0,
  rank text NOT NULL DEFAULT 'Bronze',
  streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  shields integer NOT NULL DEFAULT 1,
  total_solves integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  multiplier numeric(3,2) NOT NULL DEFAULT 1.0,
  last_active date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.arena_profiles TO authenticated;
GRANT ALL ON public.arena_profiles TO service_role;
ALTER TABLE public.arena_profiles ENABLE ROW LEVEL SECURITY;

-- rewards
CREATE TABLE public.arena_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  rarity arena_reward_rarity NOT NULL DEFAULT 'common',
  reason text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arena_rewards TO authenticated;
GRANT ALL ON public.arena_rewards TO service_role;
ALTER TABLE public.arena_rewards ENABLE ROW LEVEL SECURITY;

-- titles
CREATE TABLE public.arena_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title)
);
GRANT SELECT, INSERT ON public.arena_titles TO authenticated;
GRANT ALL ON public.arena_titles TO service_role;
ALTER TABLE public.arena_titles ENABLE ROW LEVEL SECURITY;

-- battles
CREATE TABLE public.arena_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  mode arena_battle_mode NOT NULL DEFAULT '1v1',
  state arena_battle_state NOT NULL DEFAULT 'pending',
  challenge_id uuid REFERENCES public.arena_challenges(id) ON DELETE SET NULL,
  school_id uuid,
  winner_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 600,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_battles TO authenticated;
GRANT ALL ON public.arena_battles TO service_role;
ALTER TABLE public.arena_battles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.arena_battle_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.arena_battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  team text,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'joined',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battle_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_battle_participants TO authenticated;
GRANT ALL ON public.arena_battle_participants TO service_role;
ALTER TABLE public.arena_battle_participants ENABLE ROW LEVEL SECURITY;

-- school rankings
CREATE TABLE public.arena_school_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  season_id uuid REFERENCES public.arena_seasons(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  rank integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, season_id)
);
GRANT SELECT ON public.arena_school_rankings TO authenticated;
GRANT ALL ON public.arena_school_rankings TO service_role;
ALTER TABLE public.arena_school_rankings ENABLE ROW LEVEL SECURITY;

-- teacher insights
CREATE TABLE public.arena_teacher_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  challenge_id uuid REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arena_teacher_insights TO authenticated;
GRANT ALL ON public.arena_teacher_insights TO service_role;
ALTER TABLE public.arena_teacher_insights ENABLE ROW LEVEL SECURITY;

-- replays
CREATE TABLE public.arena_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.arena_attempts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.arena_replays TO authenticated;
GRANT ALL ON public.arena_replays TO service_role;
ALTER TABLE public.arena_replays ENABLE ROW LEVEL SECURITY;

-- ============= POLICIES (all tables exist now)
CREATE POLICY "Published challenges viewable" ON public.arena_challenges FOR SELECT
  USING (status='published' OR creator_id=auth.uid() OR is_mod_or_admin(auth.uid()));
CREATE POLICY "Authed create challenges" ON public.arena_challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator or mods update" ON public.arena_challenges FOR UPDATE
  USING (auth.uid()=creator_id OR is_mod_or_admin(auth.uid()));
CREATE POLICY "Creator or mods delete" ON public.arena_challenges FOR DELETE
  USING (auth.uid()=creator_id OR is_mod_or_admin(auth.uid()));

CREATE POLICY "Questions follow challenge" ON public.arena_challenge_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.status='published' OR c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))));
CREATE POLICY "Creator manages questions" ON public.arena_challenge_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))));

CREATE POLICY "Own attempts or public passed" ON public.arena_attempts FOR SELECT
  USING (auth.uid()=user_id OR status='passed' OR is_mod_or_admin(auth.uid()));
CREATE POLICY "Insert own attempts" ON public.arena_attempts FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Update own attempts" ON public.arena_attempts FOR UPDATE USING (auth.uid()=user_id);

CREATE POLICY "Hints follow challenge" ON public.arena_hints FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.status='published' OR c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))));
CREATE POLICY "Creator manages hints" ON public.arena_hints FOR ALL
  USING (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id=challenge_id
    AND (c.creator_id=auth.uid() OR is_mod_or_admin(auth.uid()))));

CREATE POLICY "Arena comments viewable" ON public.arena_comments FOR SELECT USING (true);
CREATE POLICY "Authed post arena comments" ON public.arena_comments FOR INSERT WITH CHECK (auth.uid()=author_id);
CREATE POLICY "Author edits comment" ON public.arena_comments FOR UPDATE USING (auth.uid()=author_id);
CREATE POLICY "Author or mod deletes comment" ON public.arena_comments FOR DELETE
  USING (auth.uid()=author_id OR is_mod_or_admin(auth.uid()));

CREATE POLICY "Reactions viewable" ON public.arena_reactions FOR SELECT USING (true);
CREATE POLICY "Users react" ON public.arena_reactions FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users unreact" ON public.arena_reactions FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "Solutions viewable" ON public.arena_shared_solutions FOR SELECT USING (true);
CREATE POLICY "Authed share solution" ON public.arena_shared_solutions FOR INSERT WITH CHECK (auth.uid()=author_id);
CREATE POLICY "Author edits solution" ON public.arena_shared_solutions FOR UPDATE USING (auth.uid()=author_id);
CREATE POLICY "Author or mod deletes solution" ON public.arena_shared_solutions FOR DELETE
  USING (auth.uid()=author_id OR is_mod_or_admin(auth.uid()));

CREATE POLICY "Daily viewable" ON public.arena_daily_challenges FOR SELECT USING (true);
CREATE POLICY "Mods write daily" ON public.arena_daily_challenges FOR ALL
  USING (is_mod_or_admin(auth.uid())) WITH CHECK (is_mod_or_admin(auth.uid()));

CREATE POLICY "Seasons viewable" ON public.arena_seasons FOR SELECT USING (true);
CREATE POLICY "Mods write seasons" ON public.arena_seasons FOR ALL
  USING (is_mod_or_admin(auth.uid())) WITH CHECK (is_mod_or_admin(auth.uid()));

CREATE POLICY "Arena profiles viewable" ON public.arena_profiles FOR SELECT USING (true);
CREATE POLICY "Insert own arena profile" ON public.arena_profiles FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Update own arena profile" ON public.arena_profiles FOR UPDATE USING (auth.uid()=user_id);

CREATE POLICY "View own rewards" ON public.arena_rewards FOR SELECT
  USING (auth.uid()=user_id OR is_mod_or_admin(auth.uid()));
CREATE POLICY "Insert own rewards" ON public.arena_rewards FOR INSERT WITH CHECK (auth.uid()=user_id);

CREATE POLICY "Titles viewable" ON public.arena_titles FOR SELECT USING (true);
CREATE POLICY "Insert own titles" ON public.arena_titles FOR INSERT
  WITH CHECK (auth.uid()=user_id OR is_mod_or_admin(auth.uid()));

CREATE POLICY "Battles viewable" ON public.arena_battles FOR SELECT
  USING (auth.uid()=host_id
    OR EXISTS (SELECT 1 FROM public.arena_battle_participants p WHERE p.battle_id=arena_battles.id AND p.user_id=auth.uid())
    OR state IN ('live','finished'));
CREATE POLICY "Host creates battle" ON public.arena_battles FOR INSERT WITH CHECK (auth.uid()=host_id);
CREATE POLICY "Host updates battle" ON public.arena_battles FOR UPDATE USING (auth.uid()=host_id);
CREATE POLICY "Host deletes battle" ON public.arena_battles FOR DELETE USING (auth.uid()=host_id);

CREATE POLICY "Participants viewable" ON public.arena_battle_participants FOR SELECT USING (true);
CREATE POLICY "Users join battles" ON public.arena_battle_participants FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users update own participant" ON public.arena_battle_participants FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "Users or host remove participant" ON public.arena_battle_participants FOR DELETE
  USING (auth.uid()=user_id
    OR EXISTS (SELECT 1 FROM public.arena_battles b WHERE b.id=battle_id AND b.host_id=auth.uid()));

CREATE POLICY "School rankings viewable" ON public.arena_school_rankings FOR SELECT USING (true);
CREATE POLICY "Mods write school rankings" ON public.arena_school_rankings FOR ALL
  USING (is_mod_or_admin(auth.uid())) WITH CHECK (is_mod_or_admin(auth.uid()));

CREATE POLICY "Teacher views own insights" ON public.arena_teacher_insights FOR SELECT
  USING (auth.uid()=teacher_id OR is_mod_or_admin(auth.uid()));

CREATE POLICY "Own replay or mods" ON public.arena_replays FOR SELECT
  USING (auth.uid()=user_id OR is_mod_or_admin(auth.uid()));
CREATE POLICY "Insert own replay" ON public.arena_replays FOR INSERT WITH CHECK (auth.uid()=user_id);

-- triggers
CREATE TRIGGER trg_arena_challenges_updated BEFORE UPDATE ON public.arena_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_arena_comments_updated BEFORE UPDATE ON public.arena_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_arena_profiles_updated BEFORE UPDATE ON public.arena_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create arena_profile on new profile insert
CREATE OR REPLACE FUNCTION public.ensure_arena_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.arena_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profile_to_arena AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_arena_profile();

-- backfill
INSERT INTO public.arena_profiles (user_id)
SELECT id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;