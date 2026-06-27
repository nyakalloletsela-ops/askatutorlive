
-- 1. assignment_submissions INSERT — require student role
DROP POLICY IF EXISTS "student creates own submission" ON public.assignment_submissions;
CREATE POLICY "student creates own submission"
ON public.assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student'::app_role)
);

-- 2. promotions — restrict SELECT to authenticated only (no anon)
DROP POLICY IF EXISTS "auth users read active promotions" ON public.promotions;
CREATE POLICY "auth users read active promotions"
ON public.promotions
FOR SELECT TO authenticated
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
);
REVOKE SELECT ON public.promotions FROM anon;

-- 3. session-files storage — add UPDATE policy mirroring DELETE
DROP POLICY IF EXISTS "tutor or admin update session-files objects" ON storage.objects;
CREATE POLICY "tutor or admin update session-files objects"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'session-files'
  AND public.can_access_classroom_room((storage.foldername(name))[1])
  AND (public.has_role(auth.uid(), 'tutor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  bucket_id = 'session-files'
  AND public.can_access_classroom_room((storage.foldername(name))[1])
  AND (public.has_role(auth.uid(), 'tutor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- 4 & 5. Realtime channel authorization for notifications and whiteboard topics.
-- Restrict who may subscribe/broadcast on these realtime topics.
DROP POLICY IF EXISTS "users read own notification topic" ON realtime.messages;
CREATE POLICY "users read own notification topic"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'notif-bell-%'
      THEN substring(realtime.topic() from 12) = auth.uid()::text
    WHEN realtime.topic() LIKE 'notif-%'
      THEN substring(realtime.topic() from 7) = auth.uid()::text
    ELSE true
  END
);

DROP POLICY IF EXISTS "room members access whiteboard topic" ON realtime.messages;
CREATE POLICY "room members access whiteboard topic"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'whiteboard:%'
      THEN public.can_access_classroom_room(substring(realtime.topic() from 12))
    ELSE true
  END
);

DROP POLICY IF EXISTS "room members broadcast whiteboard topic" ON realtime.messages;
CREATE POLICY "room members broadcast whiteboard topic"
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'whiteboard:%'
      THEN public.can_access_classroom_room(substring(realtime.topic() from 12))
    WHEN realtime.topic() LIKE 'notif-bell-%'
      THEN substring(realtime.topic() from 12) = auth.uid()::text
    WHEN realtime.topic() LIKE 'notif-%'
      THEN substring(realtime.topic() from 7) = auth.uid()::text
    ELSE true
  END
);
