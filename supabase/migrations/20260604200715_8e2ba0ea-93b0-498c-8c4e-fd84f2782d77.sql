
-- Add profile fields for richer teacher/student profiles + verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS experience TEXT,
  ADD COLUMN IF NOT EXISTS subjects TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS teaching_philosophy TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intro_video_url TEXT,
  ADD COLUMN IF NOT EXISTS career_goal TEXT,
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_days INTEGER NOT NULL DEFAULT 0;

-- Calls table for video/voice
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  room_type TEXT NOT NULL,
  title TEXT,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'calling',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calls readable by anyone authed" ON public.calls;
CREATE POLICY "calls readable by anyone authed" ON public.calls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "host inserts calls" ON public.calls;
CREATE POLICY "host inserts calls" ON public.calls FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
DROP POLICY IF EXISTS "any authed update call status" ON public.calls;
CREATE POLICY "any authed update call status" ON public.calls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS calls_room_name_idx ON public.calls(room_name);
CREATE INDEX IF NOT EXISTS calls_status_created_idx ON public.calls(status, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Call participants
CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_participants TO authenticated;
GRANT ALL ON public.call_participants TO service_role;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants readable" ON public.call_participants;
CREATE POLICY "participants readable" ON public.call_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "self insert participant" ON public.call_participants;
CREATE POLICY "self insert participant" ON public.call_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "self update participant" ON public.call_participants;
CREATE POLICY "self update participant" ON public.call_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Teacher endorsements (teacher endorses student)
CREATE TABLE IF NOT EXISTS public.endorsements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endorsements TO authenticated;
GRANT SELECT ON public.endorsements TO anon;
GRANT ALL ON public.endorsements TO service_role;
ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "endorsements public" ON public.endorsements;
CREATE POLICY "endorsements public" ON public.endorsements FOR SELECT USING (true);
DROP POLICY IF EXISTS "teacher writes own endorsement" ON public.endorsements;
CREATE POLICY "teacher writes own endorsement" ON public.endorsements FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "teacher deletes own endorsement" ON public.endorsements;
CREATE POLICY "teacher deletes own endorsement" ON public.endorsements FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- Verification requests
CREATE TABLE IF NOT EXISTS public.teacher_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_verifications TO authenticated;
GRANT ALL ON public.teacher_verifications TO service_role;
ALTER TABLE public.teacher_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read verification" ON public.teacher_verifications;
CREATE POLICY "self read verification" ON public.teacher_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));
DROP POLICY IF EXISTS "self insert verification" ON public.teacher_verifications;
CREATE POLICY "self insert verification" ON public.teacher_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin update verification" ON public.teacher_verifications;
CREATE POLICY "admin update verification" ON public.teacher_verifications FOR UPDATE TO authenticated USING (public.is_mod_or_admin(auth.uid()));
