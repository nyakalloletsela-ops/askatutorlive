-- Fix 1: course-materials storage SELECT for students with access via course_material_access
CREATE POLICY "students read granted course materials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1
    FROM public.course_material_access cma
    JOIN public.course_materials cm ON cm.id = cma.material_id
    WHERE cma.student_id = auth.uid()
      AND cm.storage_path = storage.objects.name
  )
);

-- Fix 2: realtime.messages — replace permissive ELSE true with explicit deny
DROP POLICY IF EXISTS "room members access whiteboard topic" ON realtime.messages;
CREATE POLICY "room members access whiteboard topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'whiteboard:%' THEN public.can_access_classroom_room(SUBSTRING(realtime.topic() FROM 12))
    ELSE false
  END
);

DROP POLICY IF EXISTS "room members broadcast whiteboard topic" ON realtime.messages;
CREATE POLICY "room members broadcast whiteboard topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'whiteboard:%' THEN public.can_access_classroom_room(SUBSTRING(realtime.topic() FROM 12))
    WHEN realtime.topic() LIKE 'notif-bell-%' THEN SUBSTRING(realtime.topic() FROM 12) = auth.uid()::text
    WHEN realtime.topic() LIKE 'notif-%' THEN SUBSTRING(realtime.topic() FROM 7) = auth.uid()::text
    ELSE false
  END
);

-- Fix 3: tutor_availability — limit public read to authenticated users only
DROP POLICY IF EXISTS "anyone views availability" ON public.tutor_availability;
CREATE POLICY "authenticated users view availability"
ON public.tutor_availability FOR SELECT TO authenticated
USING (true);
-- Note: the public booking flow reads availability via the SECURITY DEFINER RPC
-- public.get_tutor_availability_public(_tutor uuid), so anonymous visitors still
-- get per-tutor availability for booking without exposing the full table.