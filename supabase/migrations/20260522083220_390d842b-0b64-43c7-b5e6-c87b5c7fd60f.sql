
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_minutes_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET free_minutes_remaining = 300
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'student')
  AND free_minutes_remaining = 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _chosen text;
BEGIN
  _chosen := lower(coalesce(NEW.raw_user_meta_data->>'account_type', 'student'));
  INSERT INTO public.profiles (id, full_name, free_minutes_remaining)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          CASE WHEN _chosen = 'tutor' THEN 0 ELSE 300 END);
  IF _chosen = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tutor');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  RETURN NEW;
END; $f$;

CREATE OR REPLACE FUNCTION public.sessions_consume_free_minutes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE _remaining int;
BEGIN
  IF NEW.is_free THEN
    SELECT free_minutes_remaining INTO _remaining FROM public.profiles WHERE id = NEW.student_id FOR UPDATE;
    IF _remaining IS NULL OR _remaining < NEW.duration_min THEN
      RAISE EXCEPTION 'Not enough free minutes remaining';
    END IF;
    UPDATE public.profiles SET free_minutes_remaining = free_minutes_remaining - NEW.duration_min WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END; $f$;

DROP TRIGGER IF EXISTS trg_sessions_consume_free_minutes ON public.sessions;
CREATE TRIGGER trg_sessions_consume_free_minutes
BEFORE INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_consume_free_minutes();

CREATE TABLE IF NOT EXISTS public.tutor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  session_id uuid,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, tutor_id, session_id)
);

ALTER TABLE public.tutor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews readable by everyone" ON public.tutor_reviews;
CREATE POLICY "reviews readable by everyone" ON public.tutor_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "student writes own review" ON public.tutor_reviews;
CREATE POLICY "student writes own review" ON public.tutor_reviews
FOR INSERT WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.tutor_id = tutor_reviews.tutor_id AND s.student_id = auth.uid())
);

DROP POLICY IF EXISTS "student updates own review" ON public.tutor_reviews;
CREATE POLICY "student updates own review" ON public.tutor_reviews FOR UPDATE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student deletes own review" ON public.tutor_reviews;
CREATE POLICY "student deletes own review" ON public.tutor_reviews FOR DELETE USING (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_tutor_reviews_tutor ON public.tutor_reviews(tutor_id);

DROP FUNCTION IF EXISTS public.list_public_tutors();
CREATE FUNCTION public.list_public_tutors()
RETURNS TABLE(
  id uuid, full_name text, bio text, subjects text[], hourly_rate numeric,
  avatar_url text, is_featured boolean, avg_rating numeric, review_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  SELECT p.id, p.full_name, p.bio, p.subjects, p.hourly_rate, p.avatar_url, p.is_featured,
         COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
         COALESCE(COUNT(r.id), 0)::int AS review_count
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tutor'
  LEFT JOIN public.tutor_reviews r ON r.tutor_id = p.id
  GROUP BY p.id
  ORDER BY p.is_featured DESC, avg_rating DESC, p.created_at DESC;
$f$;
