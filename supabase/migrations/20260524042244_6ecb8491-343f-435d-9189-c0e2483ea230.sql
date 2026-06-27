
-- Application status enum
DO $$ BEGIN
  CREATE TYPE public.tutor_application_status AS ENUM ('pending','approved','rejected','needs_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Application table
CREATE TABLE IF NOT EXISTS public.tutor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  bio text NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  qualifications text NOT NULL,
  status public.tutor_application_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_applications_user ON public.tutor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_applications_status ON public.tutor_applications(status);

ALTER TABLE public.tutor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applicants insert own application"
ON public.tutor_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "applicants view own application"
ON public.tutor_applications FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "applicants update own pending application"
ON public.tutor_applications FOR UPDATE TO authenticated
USING (
  (auth.uid() = user_id AND status IN ('pending','needs_info'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() = user_id AND status IN ('pending','needs_info'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER tutor_applications_touch
BEFORE UPDATE ON public.tutor_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Documents table
CREATE TABLE IF NOT EXISTS public.tutor_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.tutor_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_app_docs_app ON public.tutor_application_documents(application_id);

ALTER TABLE public.tutor_application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applicants insert own docs"
ON public.tutor_application_documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "applicants view docs"
ON public.tutor_application_documents FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "applicants delete own docs"
ON public.tutor_application_documents FOR DELETE TO authenticated
USING (
  (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.tutor_applications a
    WHERE a.id = application_id AND a.status IN ('pending','needs_info')
  ))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutor-applications', 'tutor-applications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: files stored under {user_id}/...
CREATE POLICY "applicants upload own application files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tutor-applications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "applicants read own application files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tutor-applications'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "applicants delete own application files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tutor-applications'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Approve/reject RPCs (admin only)
CREATE OR REPLACE FUNCTION public.approve_tutor_application(_application_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT user_id INTO _uid FROM public.tutor_applications WHERE id = _application_id;
  IF _uid IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE public.tutor_applications
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _notes
  WHERE id = _application_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'tutor'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_tutor_application(_application_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.tutor_applications
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = _notes
  WHERE id = _application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_tutor_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_tutor_application(uuid, text) TO authenticated;

-- Remove instant self-promotion
DROP FUNCTION IF EXISTS public.become_tutor();
