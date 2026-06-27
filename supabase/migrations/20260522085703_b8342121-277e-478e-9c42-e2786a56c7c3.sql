
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX forum_posts_parent_idx ON public.forum_posts(parent_id);
CREATE INDEX forum_posts_created_idx ON public.forum_posts(created_at DESC);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads forum posts"
  ON public.forum_posts FOR SELECT
  USING (true);

CREATE POLICY "auth users create own posts"
  ON public.forum_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own posts"
  ON public.forum_posts FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users delete own posts"
  ON public.forum_posts FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Public view to expose author display name without leaking phone/email
CREATE OR REPLACE VIEW public.forum_posts_public AS
SELECT
  fp.id, fp.user_id, fp.parent_id, fp.title, fp.body, fp.subject,
  fp.created_at, fp.updated_at,
  COALESCE(p.full_name, 'Anonymous') AS author_name
FROM public.forum_posts fp
LEFT JOIN public.profiles p ON p.id = fp.user_id;

GRANT SELECT ON public.forum_posts_public TO anon, authenticated;
