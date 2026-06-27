
CREATE POLICY "tutor upload own course materials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'tutor')
  );

CREATE POLICY "tutor read own course materials"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "tutor update own course materials"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "tutor delete own course materials"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-materials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
