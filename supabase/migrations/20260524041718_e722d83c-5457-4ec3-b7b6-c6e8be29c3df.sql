
-- 1) tutor_reviews: drop public USING:true, expose safe public view instead
DROP POLICY IF EXISTS "reviews readable by everyone" ON public.tutor_reviews;

CREATE POLICY "participants and admins read reviews"
ON public.tutor_reviews
FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR auth.uid() = tutor_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP VIEW IF EXISTS public.tutor_reviews_public;
CREATE VIEW public.tutor_reviews_public
WITH (security_invoker = false) AS
SELECT id, tutor_id, rating, comment, created_at
FROM public.tutor_reviews;

GRANT SELECT ON public.tutor_reviews_public TO anon, authenticated;

-- 2) sessions: add WITH CHECK protecting immutable + sensitive cols, also protect is_free
CREATE OR REPLACE FUNCTION public.sessions_protect_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.tutor_id   IS DISTINCT FROM OLD.tutor_id   THEN RAISE EXCEPTION 'tutor_id is immutable';   END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'student_id is immutable'; END IF;
  IF NEW.room_id    IS DISTINCT FROM OLD.room_id    THEN RAISE EXCEPTION 'room_id is immutable';    END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  IF NEW.is_free    IS DISTINCT FROM OLD.is_free    THEN RAISE EXCEPTION 'is_free is immutable';    END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sessions_protect_immutable_cols_trg ON public.sessions;
CREATE TRIGGER sessions_protect_immutable_cols_trg
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_protect_immutable_cols();

DROP POLICY IF EXISTS "participants update session" ON public.sessions;
CREATE POLICY "participants update session"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = tutor_id OR auth.uid() = student_id)
WITH CHECK (auth.uid() = tutor_id OR auth.uid() = student_id);

-- 3) forum_posts: restrict INSERT to authenticated role
DROP POLICY IF EXISTS "auth users create own posts" ON public.forum_posts;
CREATE POLICY "auth users create own posts"
ON public.forum_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
