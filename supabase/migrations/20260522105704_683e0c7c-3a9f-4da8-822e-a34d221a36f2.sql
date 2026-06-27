
DROP FUNCTION IF EXISTS public.list_public_tutors();

CREATE FUNCTION public.list_public_tutors()
 RETURNS TABLE(id uuid, full_name text, bio text, subjects text[], hourly_rate numeric, avatar_url text, is_featured boolean, avg_rating numeric, review_count integer, session_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.bio, p.subjects, p.hourly_rate, p.avatar_url, p.is_featured,
         COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
         COALESCE(COUNT(DISTINCT r.id), 0)::int AS review_count,
         COALESCE((SELECT COUNT(*)::int FROM public.sessions s WHERE s.tutor_id = p.id), 0) AS session_count
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tutor'
  LEFT JOIN public.tutor_reviews r ON r.tutor_id = p.id
  GROUP BY p.id
  ORDER BY p.is_featured DESC, session_count DESC, avg_rating DESC, p.created_at DESC;
$function$;
