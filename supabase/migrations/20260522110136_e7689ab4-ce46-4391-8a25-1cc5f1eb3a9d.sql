
-- Level enum
DO $$ BEGIN
  CREATE TYPE public.subject_level AS ENUM ('primary', 'high_school', 'tertiary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Approval status enum (reuses pattern from sub_status)
DO $$ BEGIN
  CREATE TYPE public.course_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Official catalog (managed by admins)
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level public.subject_level NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, level)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads subjects" ON public.subjects;
CREATE POLICY "anyone reads subjects" ON public.subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage subjects" ON public.subjects;
CREATE POLICY "admins manage subjects" ON public.subjects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tutor-proposed courses
CREATE TABLE IF NOT EXISTS public.tutor_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  name text NOT NULL,
  level public.subject_level NOT NULL,
  description text,
  status public.course_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor reads own courses" ON public.tutor_courses;
CREATE POLICY "tutor reads own courses" ON public.tutor_courses FOR SELECT
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin') OR status = 'approved');

DROP POLICY IF EXISTS "tutor inserts own course" ON public.tutor_courses;
CREATE POLICY "tutor inserts own course" ON public.tutor_courses FOR INSERT
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));

DROP POLICY IF EXISTS "admin manages courses" ON public.tutor_courses;
CREATE POLICY "admin manages courses" ON public.tutor_courses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin deletes courses" ON public.tutor_courses;
CREATE POLICY "admin deletes courses" ON public.tutor_courses FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR (auth.uid() = tutor_id AND status = 'pending'));

-- Seed common subjects
INSERT INTO public.subjects (name, level) VALUES
  ('English','primary'),('Mathematics','primary'),('Science','primary'),('Sesotho','primary'),('Social Studies','primary'),
  ('English Language','high_school'),('English Literature','high_school'),('Mathematics','high_school'),
  ('Additional Mathematics','high_school'),('Physics','high_school'),('Chemistry','high_school'),
  ('Biology','high_school'),('Combined Science','high_school'),('History','high_school'),
  ('Geography','high_school'),('Business Studies','high_school'),('Economics','high_school'),
  ('Accounting','high_school'),('Computer Science','high_school'),('Sesotho','high_school'),
  ('Calculus','tertiary'),('Linear Algebra','tertiary'),('Statistics','tertiary'),
  ('Microeconomics','tertiary'),('Macroeconomics','tertiary'),('Financial Accounting','tertiary'),
  ('Programming (Python)','tertiary'),('Programming (Java)','tertiary'),('Data Structures','tertiary'),
  ('Databases','tertiary'),('Engineering Mathematics','tertiary'),('Mechanics','tertiary'),
  ('Electrical Circuits','tertiary'),('Organic Chemistry','tertiary'),('Cell Biology','tertiary'),
  ('Research Methods','tertiary'),('Academic Writing','tertiary')
ON CONFLICT (name, level) DO NOTHING;
