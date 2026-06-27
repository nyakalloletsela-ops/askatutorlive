DROP POLICY IF EXISTS "student book session" ON public.sessions;

CREATE POLICY "auth user book session"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND auth.uid() <> tutor_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = sessions.tutor_id AND ur.role = 'tutor'::app_role
  )
);