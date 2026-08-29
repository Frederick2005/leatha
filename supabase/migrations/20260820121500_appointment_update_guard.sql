-- The existing "appt_update_party" RLS policy only checks that the caller is
-- the teacher or student on the row - it does not restrict WHICH columns
-- they change or what status transitions are legal. That means a student
-- could currently call `.update({ status: 'completed' })` (or bump
-- price_cents) directly against Supabase without ever going through the
-- confirm/complete buttons in the UI. RLS row policies can't compare
-- OLD vs NEW column values on their own, so this is enforced with a trigger.

CREATE OR REPLACE FUNCTION public.enforce_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions/admin tooling) bypasses these business rules
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Core booking + financial details are immutable after creation by either party.
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.subject IS DISTINCT FROM OLD.subject THEN
    RAISE EXCEPTION 'Only status and notes can be changed on an existing appointment';
  END IF;

  -- Terminal states can't be reopened.
  IF OLD.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This appointment is already %, its status cannot change', OLD.status;
  END IF;

  -- Valid transitions, gated by which party is allowed to make them.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      IF auth.uid() <> OLD.teacher_id THEN
        RAISE EXCEPTION 'Only the teacher can confirm a booking';
      END IF;
    ELSIF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed') THEN
      IF auth.uid() NOT IN (OLD.teacher_id, OLD.student_id) THEN
        RAISE EXCEPTION 'Only a party to this appointment can cancel it';
      END IF;
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'completed' THEN
      IF auth.uid() <> OLD.teacher_id THEN
        RAISE EXCEPTION 'Only the teacher can mark a session complete';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_appointment_update ON public.appointments;
CREATE TRIGGER trg_enforce_appointment_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_update();
