DROP POLICY IF EXISTS "participants update session" ON public.sessions;

CREATE POLICY "participants update session"
ON public.sessions
FOR UPDATE
USING (auth.uid() = tutor_id OR auth.uid() = student_id)
WITH CHECK (
  (auth.uid() = tutor_id OR auth.uid() = student_id)
  AND tutor_id   = (SELECT s.tutor_id   FROM public.sessions s WHERE s.id = sessions.id)
  AND student_id = (SELECT s.student_id FROM public.sessions s WHERE s.id = sessions.id)
  AND room_id IS NOT DISTINCT FROM (SELECT s.room_id FROM public.sessions s WHERE s.id = sessions.id)
);