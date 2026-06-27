
-- 1) user_roles: restrict reads to self (+ admins manage policy already covers admin reads via has_role bypass)
DROP POLICY IF EXISTS "anyone view roles" ON public.user_roles;
CREATE POLICY "users read own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2) sessions INSERT: also require tutor_id to actually be a tutor
DROP POLICY IF EXISTS "student book session" ON public.sessions;
CREATE POLICY "student book session"
ON public.sessions
FOR INSERT
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = tutor_id AND ur.role = 'tutor')
);

-- 3) sessions UPDATE: keep "participants can update" but block changes to participant/room columns via trigger
CREATE OR REPLACE FUNCTION public.sessions_protect_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.tutor_id   IS DISTINCT FROM OLD.tutor_id   THEN RAISE EXCEPTION 'tutor_id is immutable';   END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'student_id is immutable'; END IF;
  IF NEW.room_id    IS DISTINCT FROM OLD.room_id    THEN RAISE EXCEPTION 'room_id is immutable';    END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_protect_immutable_cols ON public.sessions;
CREATE TRIGGER sessions_protect_immutable_cols
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_protect_immutable_cols();

-- 4) Realtime: stop broadcasting profile + session row changes
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.sessions;
