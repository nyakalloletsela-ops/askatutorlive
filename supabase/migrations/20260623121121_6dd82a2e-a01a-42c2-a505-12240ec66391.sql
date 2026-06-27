ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS processed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.simulation_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('object', 'animation', 'texture', 'knowledge')),
  asset_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_assets TO authenticated;
GRANT ALL ON public.simulation_assets TO service_role;

ALTER TABLE public.simulation_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read own simulation assets" ON public.simulation_assets;
CREATE POLICY "owners read own simulation assets"
ON public.simulation_assets
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners insert own simulation assets" ON public.simulation_assets;
CREATE POLICY "owners insert own simulation assets"
ON public.simulation_assets
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.simulations s
    WHERE s.id = simulation_assets.simulation_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "owners update own simulation assets" ON public.simulation_assets;
CREATE POLICY "owners update own simulation assets"
ON public.simulation_assets
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners delete own simulation assets" ON public.simulation_assets;
CREATE POLICY "owners delete own simulation assets"
ON public.simulation_assets
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.simulation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  prompt text NOT NULL,
  schema_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulation_id, version_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_versions TO authenticated;
GRANT ALL ON public.simulation_versions TO service_role;

ALTER TABLE public.simulation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read own simulation versions" ON public.simulation_versions;
CREATE POLICY "owners read own simulation versions"
ON public.simulation_versions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners insert own simulation versions" ON public.simulation_versions;
CREATE POLICY "owners insert own simulation versions"
ON public.simulation_versions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.simulations s
    WHERE s.id = simulation_versions.simulation_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "owners update own simulation versions" ON public.simulation_versions;
CREATE POLICY "owners update own simulation versions"
ON public.simulation_versions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners delete own simulation versions" ON public.simulation_versions;
CREATE POLICY "owners delete own simulation versions"
ON public.simulation_versions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS simulation_assets_owner_idx ON public.simulation_assets (user_id, simulation_id);
CREATE INDEX IF NOT EXISTS simulation_versions_owner_idx ON public.simulation_versions (user_id, simulation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS simulations_tags_idx ON public.simulations USING gin (tags);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_simulations_updated_at ON public.simulations;
CREATE TRIGGER set_simulations_updated_at
BEFORE UPDATE ON public.simulations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();