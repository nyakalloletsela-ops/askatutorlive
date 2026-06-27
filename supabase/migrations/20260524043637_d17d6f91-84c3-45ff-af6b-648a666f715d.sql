
-- Allow a tutor to create a session for any of their existing students (no booking needed)
DROP POLICY IF EXISTS "tutor schedule existing student" ON public.sessions;
CREATE POLICY "tutor schedule existing student"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = tutor_id
  AND auth.uid() <> student_id
  AND public.has_role(auth.uid(), 'tutor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.tutor_id = auth.uid() AND s.student_id = sessions.student_id
  )
);

-- Direct messages between tutors and students who share at least one session
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages (recipient_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read messages" ON public.messages
FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "send message if shared session" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> recipient_id
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE (s.tutor_id = auth.uid() AND s.student_id = recipient_id)
       OR (s.student_id = auth.uid() AND s.tutor_id = recipient_id)
  )
);

CREATE POLICY "recipient mark read" ON public.messages
FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
