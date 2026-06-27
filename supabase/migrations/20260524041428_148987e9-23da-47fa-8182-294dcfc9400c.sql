
-- 1) tutor_reviews: hide student_id from anonymous visitors
REVOKE SELECT (student_id) ON public.tutor_reviews FROM anon;

-- 2) forum_posts: hide user_id from public reads via the public view
REVOKE SELECT (user_id) ON public.forum_posts FROM anon, authenticated;

DROP VIEW IF EXISTS public.forum_posts_public;
CREATE VIEW public.forum_posts_public
WITH (security_invoker = true) AS
SELECT fp.id,
       fp.parent_id,
       fp.title,
       fp.body,
       fp.subject,
       fp.created_at,
       fp.updated_at,
       COALESCE(p.full_name, 'Anonymous'::text) AS author_name
FROM public.forum_posts fp
LEFT JOIN public.profiles p ON p.id = fp.user_id;

GRANT SELECT ON public.forum_posts_public TO anon, authenticated;

-- 3) sessions: require student role for booking
DROP POLICY IF EXISTS "student book session" ON public.sessions;
CREATE POLICY "student book session"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = sessions.tutor_id AND ur.role = 'tutor'::app_role
  )
);
