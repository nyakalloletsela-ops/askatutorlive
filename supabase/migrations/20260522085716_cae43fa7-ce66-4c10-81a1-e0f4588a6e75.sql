
DROP VIEW IF EXISTS public.forum_posts_public;
CREATE VIEW public.forum_posts_public
WITH (security_invoker = true) AS
SELECT
  fp.id, fp.user_id, fp.parent_id, fp.title, fp.body, fp.subject,
  fp.created_at, fp.updated_at,
  COALESCE(p.full_name, 'Anonymous') AS author_name
FROM public.forum_posts fp
LEFT JOIN public.profiles p ON p.id = fp.user_id;

GRANT SELECT ON public.forum_posts_public TO anon, authenticated;
