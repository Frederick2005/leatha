-- Auto-promote the first signed-up user to admin role.
-- After: insert into auth.users (handled by Supabase). Our existing public.handle_new_user
-- already inserts a default 'user' role. We add a separate trigger that
-- promotes the user to 'admin' if no admin exists yet.

CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_first_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_first_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.promote_first_user_to_admin();

-- Add account_type + school columns to profiles if not present.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS school text;

-- Update handle_new_user to capture account_type + school from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display TEXT;
  v_account_type TEXT;
  v_school TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(NEW.id::text, 1, 4)
  );
  v_display := COALESCE(NEW.raw_user_meta_data->>'display_name', v_username);
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'student');
  v_school := NEW.raw_user_meta_data->>'school';

  INSERT INTO public.profiles (id, username, display_name, account_type, school)
  VALUES (NEW.id, v_username, v_display, v_account_type, v_school)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own feedback" ON public.feedback;
CREATE POLICY "Users view own feedback"
ON public.feedback FOR SELECT
USING (auth.uid() = user_id OR is_mod_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Mods update feedback" ON public.feedback;
CREATE POLICY "Mods update feedback"
ON public.feedback FOR UPDATE
USING (is_mod_or_admin(auth.uid()));

-- Voice notes / media stored in lesson-attachments? We'll create a chat-media bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Chat media public read" ON storage.objects;
CREATE POLICY "Chat media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Authenticated users upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners delete own chat media" ON storage.objects;
CREATE POLICY "Owners delete own chat media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
