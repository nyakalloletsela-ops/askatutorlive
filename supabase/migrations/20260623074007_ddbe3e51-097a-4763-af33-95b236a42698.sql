
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approve','reject')),
  target_kind text NOT NULL DEFAULT 'tutor_application',
  application_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  tutor_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  is_bulk boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_tutor_decision(
  _action text,
  _application_ids uuid[],
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _tutors uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Invalid action %', _action;
  END IF;

  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
    INTO _tutors
    FROM public.tutor_applications
    WHERE id = ANY(_application_ids);

  INSERT INTO public.admin_audit_log (actor_id, action, application_ids, tutor_ids, is_bulk, notes)
  VALUES (auth.uid(), _action, _application_ids, _tutors, array_length(_application_ids, 1) > 1, _notes)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
