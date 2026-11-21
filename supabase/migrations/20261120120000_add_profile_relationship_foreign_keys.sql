-- Add explicit public.profiles relationships for application joins.
-- The existing auth.users foreign keys are retained. NOT VALID avoids blocking
-- deployment on legacy rows while enforcing the relationship for new writes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_teacher_profile_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_teacher_profile_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_student_profile_fkey' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_student_profile_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_profiles_user_profile_fkey' AND conrelid = 'public.teacher_profiles'::regclass) THEN
    ALTER TABLE public.teacher_profiles
      ADD CONSTRAINT teacher_profiles_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arena_battle_participants_user_id_fkey' AND conrelid = 'public.arena_battle_participants'::regclass) THEN
    ALTER TABLE public.arena_battle_participants
      ADD CONSTRAINT arena_battle_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'endorsements_teacher_profile_fkey' AND conrelid = 'public.endorsements'::regclass) THEN
    ALTER TABLE public.endorsements
      ADD CONSTRAINT endorsements_teacher_profile_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'endorsements_student_profile_fkey' AND conrelid = 'public.endorsements'::regclass) THEN
    ALTER TABLE public.endorsements
      ADD CONSTRAINT endorsements_student_profile_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suggestion_upvotes_user_id_fkey' AND conrelid = 'public.suggestion_upvotes'::regclass) THEN
    ALTER TABLE public.suggestion_upvotes
      ADD CONSTRAINT suggestion_upvotes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_suggestions_suggested_by_fkey' AND conrelid = 'public.lesson_suggestions'::regclass) THEN
    ALTER TABLE public.lesson_suggestions
      ADD CONSTRAINT lesson_suggestions_suggested_by_fkey
      FOREIGN KEY (suggested_by) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_suggestions_claimed_by_fkey' AND conrelid = 'public.lesson_suggestions'::regclass) THEN
    ALTER TABLE public.lesson_suggestions
      ADD CONSTRAINT lesson_suggestions_claimed_by_fkey
      FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

-- Make the new relationships available to PostgREST embedded selects.
NOTIFY pgrst, 'reload schema';
