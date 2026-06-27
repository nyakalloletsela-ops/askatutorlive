
-- ============ ASSIGNMENTS ============
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  subject text,
  due_at timestamptz,
  attachment_path text,
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants view assignments" ON public.assignments FOR SELECT
  USING (auth.uid() = tutor_id OR auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tutor creates assignments" ON public.assignments FOR INSERT
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));
CREATE POLICY "tutor updates own assignments" ON public.assignments FOR UPDATE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tutor deletes own assignments" ON public.assignments FOR DELETE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER assignments_touch BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_assignments_student ON public.assignments(student_id);
CREATE INDEX idx_assignments_tutor ON public.assignments(tutor_id);

-- ============ ASSIGNMENT SUBMISSIONS ============
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  file_path text,
  note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  grade text,
  feedback text,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants view submissions" ON public.assignment_submissions FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.tutor_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "student creates own submission" ON public.assignment_submissions FOR INSERT
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student or tutor updates submission" ON public.assignment_submissions FOR UPDATE
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.tutor_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "student deletes own submission" ON public.assignment_submissions FOR DELETE
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER subs_touch BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NOTES ============
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'note',
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner views notes" ON public.notes FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts notes" ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates notes" ON public.notes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes notes" ON public.notes FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER notes_touch BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_notes_user ON public.notes(user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient views notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "recipient marks read" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipient deletes own" ON public.notifications FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
-- INSERT only by service_role (system) — no policy = denied for authenticated

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============ TUTOR AVAILABILITY ============
CREATE TABLE public.tutor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min smallint NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min smallint NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tutor_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_availability TO authenticated;
GRANT ALL ON public.tutor_availability TO service_role;
ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone views availability" ON public.tutor_availability FOR SELECT USING (true);
CREATE POLICY "tutor manages own availability" ON public.tutor_availability FOR INSERT
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));
CREATE POLICY "tutor updates own availability" ON public.tutor_availability FOR UPDATE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tutor deletes own availability" ON public.tutor_availability FOR DELETE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));

-- ============ TUTOR RESOURCES ============
CREATE TABLE public.tutor_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'file',
  storage_path text,
  subject text,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_resources TO authenticated;
GRANT ALL ON public.tutor_resources TO service_role;
ALTER TABLE public.tutor_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view resources" ON public.tutor_resources FOR SELECT
  USING (
    visibility = 'public'
    OR auth.uid() = tutor_id
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "tutor inserts resources" ON public.tutor_resources FOR INSERT
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));
CREATE POLICY "tutor updates resources" ON public.tutor_resources FOR UPDATE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tutor deletes resources" ON public.tutor_resources FOR DELETE
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER resources_touch BEFORE UPDATE ON public.tutor_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
