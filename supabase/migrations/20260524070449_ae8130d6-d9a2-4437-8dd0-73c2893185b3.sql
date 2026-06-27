-- 1. Tighten realtime messages topic policy ----------------------------------
DROP POLICY IF EXISTS "authenticated can subscribe to own message threads" ON realtime.messages;

CREATE POLICY "authenticated can subscribe to own message threads"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^messages-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (
    realtime.topic() LIKE ('messages-' || auth.uid()::text || '-%')
    OR realtime.topic() LIKE ('messages-%-' || auth.uid()::text)
  )
);

-- 2. Restrict participant updates on sessions to allowed status transitions ---
CREATE OR REPLACE FUNCTION public.sessions_protect_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Truly immutable columns
  IF NEW.tutor_id   IS DISTINCT FROM OLD.tutor_id   THEN RAISE EXCEPTION 'tutor_id is immutable';   END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'student_id is immutable'; END IF;
  IF NEW.room_id    IS DISTINCT FROM OLD.room_id    THEN RAISE EXCEPTION 'room_id is immutable';    END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  IF NEW.is_free    IS DISTINCT FROM OLD.is_free    THEN RAISE EXCEPTION 'is_free is immutable';    END IF;

  -- Only admins can reschedule or change the subject/duration
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    RAISE EXCEPTION 'scheduled_at can only be changed by an admin';
  END IF;
  IF NEW.subject IS DISTINCT FROM OLD.subject THEN
    RAISE EXCEPTION 'subject can only be changed by an admin';
  END IF;
  IF NEW.duration_min IS DISTINCT FROM OLD.duration_min THEN
    RAISE EXCEPTION 'duration_min can only be changed by an admin';
  END IF;

  -- Status transitions: participants may only do specific moves
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'scheduled' THEN
      RAISE EXCEPTION 'session status can no longer be changed';
    END IF;

    IF NEW.status = 'cancelled' THEN
      IF auth.uid() <> OLD.tutor_id AND auth.uid() <> OLD.student_id THEN
        RAISE EXCEPTION 'only session participants can cancel';
      END IF;
    ELSIF NEW.status = 'completed' THEN
      IF auth.uid() <> OLD.tutor_id THEN
        RAISE EXCEPTION 'only the tutor can mark a session completed';
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid status transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger is attached (it may not exist yet despite the function)
DROP TRIGGER IF EXISTS sessions_protect_immutable_cols_trg ON public.sessions;
CREATE TRIGGER sessions_protect_immutable_cols_trg
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sessions_protect_immutable_cols();

-- 3. tutor_courses: require authentication for the public-approved branch ----
DROP POLICY IF EXISTS "tutor reads own courses" ON public.tutor_courses;

CREATE POLICY "tutor reads own courses"
ON public.tutor_courses
FOR SELECT
TO authenticated
USING (
  auth.uid() = tutor_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR status = 'approved'::course_status
);
