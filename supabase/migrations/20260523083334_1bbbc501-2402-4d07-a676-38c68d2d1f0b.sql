
-- Admin SELECT policy for sessions
CREATE POLICY "admins view all sessions"
ON public.sessions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Tighten classroom-files delete policy to require room membership
DROP POLICY IF EXISTS "classroom files: owner or admin delete" ON storage.objects;

CREATE POLICY "classroom files: owner or admin delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'classroom-files'
  AND public.can_access_classroom_room((storage.foldername(name))[1])
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);
