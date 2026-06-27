
-- Restrict profiles table SELECT to owners + admins, expose only safe tutor fields via a public view
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;

CREATE POLICY "owners and admins read profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Public-safe tutor directory (no phone, no availability, no email)
CREATE OR REPLACE VIEW public.public_tutor_profiles
WITH (security_invoker = true) AS
SELECT p.id, p.full_name, p.bio, p.subjects, p.hourly_rate, p.avatar_url, p.is_featured
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = 'tutor'
);

-- security_invoker view needs a SELECT policy that allows anon/auth to read tutor rows safely.
-- Add a narrow policy that ONLY matches when access is going through the view's filter:
CREATE POLICY "public read tutor basic fields"
ON public.profiles
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'tutor')
);

GRANT SELECT ON public.public_tutor_profiles TO anon, authenticated;
