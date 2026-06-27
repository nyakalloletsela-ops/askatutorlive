-- Fix: realtime topic wildcard — close ELSE branch
DROP POLICY IF EXISTS "users read own notification topic" ON realtime.messages;
CREATE POLICY "users read own notification topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'notif-bell-%' THEN substring(realtime.topic() FROM 12) = auth.uid()::text
    WHEN realtime.topic() LIKE 'notif-%'      THEN substring(realtime.topic() FROM 7)  = auth.uid()::text
    ELSE false
  END
);

-- Fix: payment_providers no longer readable by all authenticated users
DROP POLICY IF EXISTS "providers readable by authenticated" ON public.payment_providers;
-- (Admin-only "providers admin write" FOR ALL policy already covers admin reads.)

-- Fix: tutor_availability — restrict to owner + admin; public booking uses get_tutor_availability_public RPC
DROP POLICY IF EXISTS "authenticated users view availability" ON public.tutor_availability;
CREATE POLICY "owner or admin reads availability"
ON public.tutor_availability
FOR SELECT
TO authenticated
USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));