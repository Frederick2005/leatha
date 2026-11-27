-- Reconcile production's half-migrated tutoring layer with the schema the app and triggers expect.
-- Additive: no columns/tables are dropped. appointments currently holds 0 rows.
-- NOTE: already applied to production (version 20261126235955); kept here so repo and DB match.

-- ---------- profiles / teacher_profiles columns ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS learning_goals text;

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio_long text,
  ADD COLUMN IF NOT EXISTS years_experience integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS students_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_bookings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

UPDATE public.teacher_profiles
SET total_earnings_cents = total_earnings
WHERE total_earnings_cents = 0 AND total_earnings <> 0;

-- ---------- appointments columns ----------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.appointments
SET subject   = COALESCE(subject, 'General'),
    starts_at = COALESCE(starts_at, scheduled_at, created_at),
    ends_at   = COALESCE(ends_at, COALESCE(scheduled_at, created_at) + interval '1 hour');

ALTER TABLE public.appointments
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appt_teacher ON public.appointments(teacher_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_student ON public.appointments(student_id, starts_at);

-- ---------- missing tables ----------
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ta_teacher ON public.teacher_availability(teacher_id);

CREATE TABLE IF NOT EXISTS public.teacher_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, appointment_id)
);
CREATE INDEX IF NOT EXISTS idx_tr_teacher ON public.teacher_reviews(teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mtn','airtel','pesapal')),
  phone_number text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','cancelled')),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pi_payer ON public.payment_intents(payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pi_payee ON public.payment_intents(payee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_rating_state (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dqi_x numeric NOT NULL DEFAULT 0,
  lis_total numeric NOT NULL DEFAULT 0,
  active_lis numeric NOT NULL DEFAULT 0,
  engine_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rating_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  quality_value numeric NOT NULL,
  trust_tau numeric,
  dqi_after numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rating_events_creator ON public.rating_events(creator_id, created_at DESC);

-- ---------- functions / triggers ----------
-- Appointment guard: also freezes payment_status for browser sessions
-- (payment must be confirmed server-side by a provider webhook).
CREATE OR REPLACE FUNCTION public.enforce_appointment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Only status, notes and payment method can be changed on an existing appointment';
  END IF;

  IF OLD.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This appointment is already %, its status cannot change', OLD.status;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      IF auth.uid() <> OLD.teacher_id THEN RAISE EXCEPTION 'Only the teacher can confirm a booking'; END IF;
    ELSIF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed') THEN
      IF auth.uid() NOT IN (OLD.teacher_id, OLD.student_id) THEN RAISE EXCEPTION 'Only a party to this appointment can cancel it'; END IF;
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'completed' THEN
      IF auth.uid() <> OLD.teacher_id THEN RAISE EXCEPTION 'Only the teacher can mark a session complete'; END IF;
    ELSE
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Replace legacy earnings trigger with an idempotent recompute that fills the new columns
-- (and keeps the legacy total_earnings column in sync).
DROP TRIGGER IF EXISTS on_appointment_earnings ON public.appointments;
DROP FUNCTION IF EXISTS public.update_teacher_earnings();

CREATE OR REPLACE FUNCTION public.on_appointment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.teacher_profiles tp
    SET total_earnings_cents = (SELECT COALESCE(SUM(price_cents), 0) FROM public.appointments WHERE teacher_id = NEW.teacher_id AND status = 'completed'),
        total_earnings = (SELECT COALESCE(SUM(price_cents), 0) FROM public.appointments WHERE teacher_id = NEW.teacher_id AND status = 'completed'),
        students_count = (SELECT COUNT(DISTINCT student_id) FROM public.appointments WHERE teacher_id = NEW.teacher_id AND status = 'completed'),
        updated_at = now()
    WHERE tp.user_id = NEW.teacher_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appt_status ON public.appointments;
CREATE TRIGGER trg_appt_status AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_change();

CREATE OR REPLACE FUNCTION public.recompute_teacher_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  tid := COALESCE(NEW.teacher_id, OLD.teacher_id);
  UPDATE public.teacher_profiles tp
  SET rating_avg = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.teacher_reviews WHERE teacher_id = tid), 0),
      rating_count = (SELECT COUNT(*) FROM public.teacher_reviews WHERE teacher_id = tid)
  WHERE tp.user_id = tid;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_tr_rating ON public.teacher_reviews;
CREATE TRIGGER trg_tr_rating AFTER INSERT OR UPDATE OR DELETE ON public.teacher_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_teacher_rating();

DROP TRIGGER IF EXISTS trg_tp_updated ON public.teacher_profiles;
CREATE TRIGGER trg_tp_updated BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_appt_updated ON public.appointments;
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pi_updated ON public.payment_intents;
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- RLS + policies ----------
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tp_select_all_auth ON public.teacher_profiles;
DROP POLICY IF EXISTS tp_insert_self ON public.teacher_profiles;
DROP POLICY IF EXISTS tp_update_self ON public.teacher_profiles;
DROP POLICY IF EXISTS tp_delete_self ON public.teacher_profiles;
CREATE POLICY tp_select_all_auth ON public.teacher_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY tp_insert_self ON public.teacher_profiles FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY tp_update_self ON public.teacher_profiles FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY tp_delete_self ON public.teacher_profiles FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appt_select_party ON public.appointments;
DROP POLICY IF EXISTS appt_insert_student ON public.appointments;
DROP POLICY IF EXISTS appt_update_party ON public.appointments;
DROP POLICY IF EXISTS appt_delete_party ON public.appointments;
DROP POLICY IF EXISTS appt_delete_pending_student ON public.appointments;
CREATE POLICY appt_select_party ON public.appointments FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (teacher_id, student_id));
CREATE POLICY appt_insert_student ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) AND status = 'pending' AND payment_status = 'pending');
CREATE POLICY appt_update_party ON public.appointments FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IN (teacher_id, student_id))
  WITH CHECK ((SELECT auth.uid()) IN (teacher_id, student_id));
CREATE POLICY appt_delete_pending_student ON public.appointments FOR DELETE TO authenticated
  USING (student_id = (SELECT auth.uid()) AND status = 'pending');

ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta_select_all_auth ON public.teacher_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY ta_manage_self ON public.teacher_availability FOR ALL TO authenticated
  USING (teacher_id = (SELECT auth.uid())) WITH CHECK (teacher_id = (SELECT auth.uid()));

ALTER TABLE public.teacher_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tr_select_all_auth ON public.teacher_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY tr_insert_student ON public.teacher_reviews FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) AND teacher_id <> (SELECT auth.uid()));
CREATE POLICY tr_update_student ON public.teacher_reviews FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid())) WITH CHECK (student_id = (SELECT auth.uid()));
CREATE POLICY tr_delete_student ON public.teacher_reviews FOR DELETE TO authenticated USING (student_id = (SELECT auth.uid()));

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pi_select_party ON public.payment_intents FOR SELECT TO authenticated USING ((SELECT auth.uid()) IN (payer_id, payee_id));
CREATE POLICY pi_insert_payer ON public.payment_intents FOR INSERT TO authenticated
  WITH CHECK (payer_id = (SELECT auth.uid()) AND status = 'pending' AND payee_id <> payer_id);
CREATE POLICY pi_cancel_own_pending ON public.payment_intents FOR UPDATE TO authenticated
  USING (payer_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (payer_id = (SELECT auth.uid()) AND status = 'cancelled');

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_mod_or_admin((SELECT auth.uid())));
CREATE POLICY "Admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_mod_or_admin((SELECT auth.uid()))) WITH CHECK (public.is_mod_or_admin((SELECT auth.uid())));

ALTER TABLE public.creator_rating_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_rating_state_select_all ON public.creator_rating_state FOR SELECT USING (true);

ALTER TABLE public.rating_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY rating_events_owner_select ON public.rating_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = creator_id);

-- ---------- grants (least privilege) ----------
REVOKE ALL ON public.appointments, public.teacher_profiles, public.teacher_availability,
  public.teacher_reviews, public.payment_intents, public.support_tickets,
  public.rating_events FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.appointments, public.teacher_profiles,
  public.teacher_availability, public.teacher_reviews, public.payment_intents,
  public.support_tickets, public.rating_events, public.creator_rating_state FROM authenticated;
REVOKE ALL ON public.creator_rating_state FROM anon;
GRANT SELECT ON public.creator_rating_state TO anon, authenticated;
GRANT SELECT ON public.rating_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_availability, public.teacher_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated;
GRANT SELECT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.teacher_availability, public.teacher_reviews, public.payment_intents,
  public.support_tickets, public.creator_rating_state, public.rating_events TO service_role;

NOTIFY pgrst, 'reload schema';
