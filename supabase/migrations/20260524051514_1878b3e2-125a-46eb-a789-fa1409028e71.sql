
-- 1) Realtime authorization for messages channels.
-- Channel topic convention in the app: `messages-<userA>-<userB>`.
-- Only allow auth'd users to subscribe when their uid appears in the topic.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can subscribe to own message threads" ON realtime.messages;
CREATE POLICY "authenticated can subscribe to own message threads"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'messages-%'
  AND position(auth.uid()::text in realtime.topic()) > 0
);

-- 2) Prevent applicants from escalating their own tutor_applications status.
DROP POLICY IF EXISTS "applicants update own pending application" ON public.tutor_applications;
CREATE POLICY "applicants update own pending application"
ON public.tutor_applications
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status IN ('pending'::tutor_application_status, 'needs_info'::tutor_application_status))
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = user_id
    AND status IN ('pending'::tutor_application_status, 'needs_info'::tutor_application_status)
  )
);

-- 3) Require 'student' role to write tutor reviews.
DROP POLICY IF EXISTS "student writes own review" ON public.tutor_reviews;
CREATE POLICY "student writes own review"
ON public.tutor_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.tutor_id = tutor_reviews.tutor_id
      AND s.student_id = auth.uid()
  )
);

-- 4) Lock search_path on email queue helpers.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
