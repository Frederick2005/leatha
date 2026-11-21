-- Create appointment notifications inside the database transaction.
-- Clients cannot insert notifications for arbitrary users because notifications
-- intentionally has no authenticated INSERT policy.

CREATE OR REPLACE FUNCTION public.notify_teacher_on_appointment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
BEGIN
  SELECT COALESCE(NULLIF(display_name, ''), username, 'A student')
    INTO v_student_name
    FROM public.profiles
    WHERE id = NEW.student_id;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    link,
    related_id
  ) VALUES (
    NEW.teacher_id,
    'new_appointment',
    'New booking request',
    COALESCE(v_student_name, 'A student') || ' requested a ' || NEW.subject || ' session. Open Appointments to review the details.',
    '/appointments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_teacher_on_appointment_created ON public.appointments;
CREATE TRIGGER notify_teacher_on_appointment_created
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_teacher_on_appointment_created();
