
-- ============ session_records ============
CREATE TABLE public.session_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  session_id uuid,
  title text,
  meeting_recording_url text,
  chat_transcript text,
  ai_summary text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_records TO authenticated;
GRANT ALL ON public.session_records TO service_role;
ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room members read records" ON public.session_records
  FOR SELECT USING (public.can_access_classroom_room(room_id));
CREATE POLICY "tutor or admin insert records" ON public.session_records
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND public.can_access_classroom_room(room_id)
    AND (public.has_role(auth.uid(),'tutor') OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "tutor or admin update records" ON public.session_records
  FOR UPDATE USING (
    public.has_role(auth.uid(),'admin')
    OR (public.can_access_classroom_room(room_id)
        AND public.has_role(auth.uid(),'tutor'))
  );
CREATE POLICY "admin delete records" ON public.session_records
  FOR DELETE USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER session_records_updated
  BEFORE UPDATE ON public.session_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ session_files ============
CREATE TABLE public.session_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.session_records(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  filename text NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_files TO authenticated;
GRANT ALL ON public.session_files TO service_role;
ALTER TABLE public.session_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room members read files" ON public.session_files
  FOR SELECT USING (public.can_access_classroom_room(room_id));
CREATE POLICY "tutor or admin upload files" ON public.session_files
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    AND public.can_access_classroom_room(room_id)
    AND (public.has_role(auth.uid(),'tutor') OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "tutor or admin update files" ON public.session_files
  FOR UPDATE USING (
    public.has_role(auth.uid(),'admin')
    OR (public.can_access_classroom_room(room_id) AND auth.uid() = uploaded_by)
  );
CREATE POLICY "tutor or admin delete files" ON public.session_files
  FOR DELETE USING (
    public.has_role(auth.uid(),'admin')
    OR (public.can_access_classroom_room(room_id) AND auth.uid() = uploaded_by)
  );

CREATE INDEX session_files_record_idx ON public.session_files(record_id);

-- ============ platform_config (singleton) ============
CREATE TABLE public.platform_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_subscriptions_enabled boolean NOT NULL DEFAULT false,
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_token_limit_per_user integer NOT NULL DEFAULT 100000,
  classrooms_enabled boolean NOT NULL DEFAULT true,
  whiteboard_graphing_enabled boolean NOT NULL DEFAULT true,
  whiteboard_latex_enabled boolean NOT NULL DEFAULT true,
  whiteboard_ocr_enabled boolean NOT NULL DEFAULT true,
  whiteboard_export_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_config TO anon, authenticated;
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads platform config" ON public.platform_config
  FOR SELECT USING (true);
CREATE POLICY "admin updates platform config" ON public.platform_config
  FOR UPDATE USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.platform_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER platform_config_updated
  BEFORE UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ promotions ============
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  amount numeric NOT NULL CHECK (amount > 0),
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages promotions" ON public.promotions
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth users read active promotions" ON public.promotions
  FOR SELECT USING (active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE TRIGGER promotions_updated
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ storage bucket for session files ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-files','session-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "room members read session-files objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-files'
    AND public.can_access_classroom_room((storage.foldername(name))[1])
  );
CREATE POLICY "tutor or admin upload session-files objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-files'
    AND public.can_access_classroom_room((storage.foldername(name))[1])
    AND (public.has_role(auth.uid(),'tutor') OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "tutor or admin delete session-files objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-files'
    AND public.can_access_classroom_room((storage.foldername(name))[1])
    AND (public.has_role(auth.uid(),'tutor') OR public.has_role(auth.uid(),'admin'))
  );
