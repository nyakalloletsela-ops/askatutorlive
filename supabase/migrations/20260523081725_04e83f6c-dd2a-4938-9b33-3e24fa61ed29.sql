
-- 1. Fix mutable search_path on functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Tighten help_messages INSERT: still allows anon, but blocks spoofing another user_id
DROP POLICY IF EXISTS "anyone can submit help message" ON public.help_messages;
CREATE POLICY "anyone can submit help message"
ON public.help_messages
FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3. Allow users to read their own help messages
CREATE POLICY "users read own help messages"
ON public.help_messages
FOR SELECT
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- 4. Storage UPDATE policy: require room membership
DROP POLICY IF EXISTS "classroom files: owner update" ON storage.objects;
CREATE POLICY "classroom files: owner update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'classroom-files'
  AND owner = auth.uid()
  AND can_access_classroom_room((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'classroom-files'
  AND owner = auth.uid()
  AND can_access_classroom_room((storage.foldername(name))[1])
);

-- 5. Restrict has_role from direct RPC access (still callable in RLS as SECURITY DEFINER owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
