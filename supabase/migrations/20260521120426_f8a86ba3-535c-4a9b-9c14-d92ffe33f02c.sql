
-- Remove the policy that re-exposed tutor profile rows publicly
DROP POLICY IF EXISTS "public read tutor basic fields" ON public.profiles;

-- Drop the invoker view and replace with a SECURITY DEFINER function that
-- returns ONLY safe columns. RLS on profiles now stays restricted to owner+admin.
DROP VIEW IF EXISTS public.public_tutor_profiles;

CREATE OR REPLACE FUNCTION public.list_public_tutors()
RETURNS TABLE (
  id uuid,
  full_name text,
  bio text,
  subjects text[],
  hourly_rate numeric,
  avatar_url text,
  is_featured boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.bio, p.subjects, p.hourly_rate, p.avatar_url, p.is_featured
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tutor'
  ORDER BY p.is_featured DESC, p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_public_tutors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_tutors() TO anon, authenticated;
