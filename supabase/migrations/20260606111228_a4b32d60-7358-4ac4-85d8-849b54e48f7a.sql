
-- TEACHER PROFILES
CREATE TABLE public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  bio_long TEXT,
  years_experience INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  total_earnings_cents BIGINT NOT NULL DEFAULT 0,
  accepts_bookings BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select_all_auth" ON public.teacher_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "tp_insert_self" ON public.teacher_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_update_self" ON public.teacher_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tp_delete_self" ON public.teacher_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- AVAILABILITY
CREATE TABLE public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ta_teacher ON public.teacher_availability(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_availability TO authenticated;
GRANT ALL ON public.teacher_availability TO service_role;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select_all_auth" ON public.teacher_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "ta_manage_self" ON public.teacher_availability FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_teacher ON public.appointments(teacher_id, starts_at);
CREATE INDEX idx_appt_student ON public.appointments(student_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt_select_party" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() IN (teacher_id, student_id));
CREATE POLICY "appt_insert_student" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "appt_update_party" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() IN (teacher_id, student_id));
CREATE POLICY "appt_delete_party" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() IN (teacher_id, student_id));

-- REVIEWS
CREATE TABLE public.teacher_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, appointment_id)
);
CREATE INDEX idx_tr_teacher ON public.teacher_reviews(teacher_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_reviews TO authenticated;
GRANT ALL ON public.teacher_reviews TO service_role;
ALTER TABLE public.teacher_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select_all_auth" ON public.teacher_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "tr_insert_student" ON public.teacher_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "tr_update_student" ON public.teacher_reviews FOR UPDATE TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "tr_delete_student" ON public.teacher_reviews FOR DELETE TO authenticated USING (auth.uid() = student_id);

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  subject TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','students','public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_owner ON public.documents(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_select_visible" ON public.documents FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR visibility = 'public' OR (visibility = 'students' AND EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.teacher_id = documents.owner_id AND a.student_id = auth.uid()
  ))
);
CREATE POLICY "doc_insert_self" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "doc_update_self" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "doc_delete_self" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- PAYMENT INTENTS (mobile money stub)
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mtn','airtel','paxtel')),
  phone_number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','cancelled')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pi_payer ON public.payment_intents(payer_id, created_at DESC);
CREATE INDEX idx_pi_payee ON public.payment_intents(payee_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_select_party" ON public.payment_intents FOR SELECT TO authenticated USING (auth.uid() IN (payer_id, payee_id));
CREATE POLICY "pi_insert_payer" ON public.payment_intents FOR INSERT TO authenticated WITH CHECK (auth.uid() = payer_id);
CREATE POLICY "pi_update_party" ON public.payment_intents FOR UPDATE TO authenticated USING (auth.uid() IN (payer_id, payee_id));

-- updated_at triggers
CREATE TRIGGER trg_tp_updated BEFORE UPDATE ON public.teacher_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.payment_intents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Review aggregate trigger
CREATE OR REPLACE FUNCTION public.recompute_teacher_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid UUID;
BEGIN
  tid := COALESCE(NEW.teacher_id, OLD.teacher_id);
  UPDATE public.teacher_profiles tp
    SET rating_avg = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM public.teacher_reviews WHERE teacher_id = tid), 0),
        rating_count = (SELECT COUNT(*) FROM public.teacher_reviews WHERE teacher_id = tid)
    WHERE tp.user_id = tid;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_tr_rating AFTER INSERT OR UPDATE OR DELETE ON public.teacher_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_teacher_rating();

-- Earnings + students count trigger on appointment status change
CREATE OR REPLACE FUNCTION public.on_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.teacher_profiles
      SET total_earnings_cents = total_earnings_cents + NEW.price_cents,
          students_count = (SELECT COUNT(DISTINCT student_id) FROM public.appointments WHERE teacher_id = NEW.teacher_id AND status = 'completed')
      WHERE user_id = NEW.teacher_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_appt_status AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_change();
