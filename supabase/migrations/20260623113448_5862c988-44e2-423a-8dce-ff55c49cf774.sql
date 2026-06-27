
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  subject text,
  title text,
  schema_json jsonb NOT NULL,
  embedding vector(1536),
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own simulations" ON public.simulations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owners insert own simulations" ON public.simulations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update own simulations" ON public.simulations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners delete own simulations" ON public.simulations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX simulations_embedding_idx ON public.simulations USING hnsw (embedding vector_cosine_ops);
CREATE INDEX simulations_user_created_idx ON public.simulations (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.match_simulations(query_embedding vector(1536), match_count int DEFAULT 5, min_similarity float DEFAULT 0.0)
RETURNS TABLE (id uuid, prompt text, subject text, title text, schema_json jsonb, thumbnail_url text, created_at timestamptz, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.prompt, s.subject, s.title, s.schema_json, s.thumbnail_url, s.created_at,
         1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.simulations s
  WHERE s.user_id = auth.uid()
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) >= min_similarity
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;
