
-- RPC: list students (id + full_name) visible to tutors and admins only
CREATE OR REPLACE FUNCTION public.list_students_for_tutor()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'tutor') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(p.full_name, 'Student') AS full_name
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'student'
    ORDER BY p.full_name NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_students_for_tutor() TO authenticated;

-- Allow tutors to schedule a session with ANY student (not only past students)
DROP POLICY IF EXISTS "tutor schedule any student" ON public.sessions;
CREATE POLICY "tutor schedule any student"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = tutor_id
  AND auth.uid() <> student_id
  AND public.has_role(auth.uid(), 'tutor')
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = sessions.student_id AND ur.role = 'student'
  )
);
