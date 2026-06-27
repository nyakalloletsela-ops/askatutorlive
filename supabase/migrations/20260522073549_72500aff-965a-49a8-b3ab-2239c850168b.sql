
-- 1) Helper: can current user access a classroom room (real session or own demo)
CREATE OR REPLACE FUNCTION public.can_access_classroom_room(_room text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR (_room LIKE 'demo-%' AND substring(_room from 6) = auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.room_id = _room
        AND (s.tutor_id = auth.uid() OR s.student_id = auth.uid())
    );
$$;

-- 2) Lock down classroom-files storage policies (room-scoped)
DROP POLICY IF EXISTS "classroom files public read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload classroom files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete own classroom files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update own classroom files" ON storage.objects;

CREATE POLICY "classroom files: members read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'classroom-files'
  AND public.can_access_classroom_room((storage.foldername(name))[1])
);

CREATE POLICY "classroom files: members upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'classroom-files'
  AND owner = auth.uid()
  AND public.can_access_classroom_room((storage.foldername(name))[1])
);

CREATE POLICY "classroom files: owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'classroom-files' AND owner = auth.uid());

CREATE POLICY "classroom files: owner or admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'classroom-files'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

-- 3) Make classroom-files bucket private (we'll use signed URLs)
UPDATE storage.buckets SET public = false WHERE id = 'classroom-files';

-- 4) Remove privilege-escalation self-assign of tutor role.
-- Students are inserted by the handle_new_user trigger; tutor role must be granted by an admin.
DROP POLICY IF EXISTS "users self-assign tutor or student role" ON public.user_roles;
