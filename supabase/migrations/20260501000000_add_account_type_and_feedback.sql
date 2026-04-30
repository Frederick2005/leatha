-- Add account_type to profiles and support feedback messages
CREATE TYPE IF NOT EXISTS public.account_type AS ENUM ('student', 'teacher', 'administrator');
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'student';

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL CHECK (length(subject) > 0 AND length(subject) <= 200),
  message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 5000),
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display TEXT;
  v_account_type public.account_type;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(NEW.id::text, 1, 4)
  );
  v_display := COALESCE(NEW.raw_user_meta_data->>'display_name', v_username);
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'student')::public.account_type;

  INSERT INTO public.profiles (id, username, display_name, account_type)
  VALUES (NEW.id, v_username, v_display, v_account_type)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN v_account_type = 'administrator' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE POLICY "Feedback is viewable by admins" ON public.feedback FOR SELECT USING (public.is_mod_or_admin(auth.uid()));
CREATE POLICY "Authenticated users submit feedback" ON public.feedback FOR INSERT WITH CHECK (
  auth.uid() = user_id OR (auth.uid() IS NULL AND user_id IS NULL)
);
CREATE POLICY "Feedback user can delete own feedback" ON public.feedback FOR DELETE USING (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));
