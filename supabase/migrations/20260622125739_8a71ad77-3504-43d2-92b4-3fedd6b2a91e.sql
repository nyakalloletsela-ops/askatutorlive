
-- =====================================================================
-- 1. PARENT ROLE
-- =====================================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _chosen text;
BEGIN
  _chosen := lower(coalesce(NEW.raw_user_meta_data->>'account_type', 'student'));
  INSERT INTO public.profiles (id, full_name, free_minutes_remaining)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
          CASE WHEN _chosen IN ('tutor','parent') THEN 0 ELSE 300 END);
  IF _chosen = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tutor');
  ELSIF _chosen = 'parent' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  RETURN NEW;
END; $function$;

-- =====================================================================
-- 2. PARENT-CHILD LINKS
-- =====================================================================
CREATE TABLE public.parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text DEFAULT 'parent',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, child_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child_links TO authenticated;
GRANT ALL ON public.parent_child_links TO service_role;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent or child can view link" ON public.parent_child_links
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR child_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "parent can manage own links" ON public.parent_child_links
  FOR ALL TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.child_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_invites TO authenticated;
GRANT ALL ON public.child_invites TO service_role;
ALTER TABLE public.child_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parents manage own invites" ON public.child_invites
  FOR ALL TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_parent_of(_child uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_child_links
    WHERE parent_id = auth.uid() AND child_id = _child AND status = 'active'
  );
$$;

CREATE POLICY "parents view children sessions" ON public.sessions
  FOR SELECT TO authenticated USING (public.is_parent_of(student_id));
CREATE POLICY "parents view children records" ON public.session_records
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_records.session_id AND public.is_parent_of(s.student_id)));
CREATE POLICY "parents view children assignments" ON public.assignments
  FOR SELECT TO authenticated USING (public.is_parent_of(student_id));

-- =====================================================================
-- 3. SUBSCRIPTION PLANS
-- =====================================================================
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('student','tutor')),
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  duration_unit text NOT NULL DEFAULT 'month' CHECK (duration_unit IN ('day','week','month','quarter','year','custom')),
  duration_count integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in views active plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin writes plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER subscription_plans_touch BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  source text NOT NULL DEFAULT 'admin',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_assignments TO authenticated;
GRANT ALL ON public.subscription_assignments TO service_role;
ALTER TABLE public.subscription_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user views own assignment" ON public.subscription_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages assignments" ON public.subscription_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER subscription_assignments_touch BEFORE UPDATE ON public.subscription_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 4. COMMISSION RULES
-- =====================================================================
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','tutor','subject','promo')),
  target_id uuid,
  target_text text,
  method text NOT NULL CHECK (method IN ('percent','fixed','hybrid')),
  percent numeric(5,2) DEFAULT 0,
  fixed_cents integer DEFAULT 0,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin views commissions" ON public.commission_rules
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin writes commissions" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER commission_rules_touch BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.commission_rules (scope, method, percent, notes)
VALUES ('global','percent',20.0,'Default platform commission');

-- =====================================================================
-- 5. CONTENT LIBRARY: add columns FIRST, then folders + versions
-- =====================================================================
ALTER TABLE public.course_materials
  ADD COLUMN IF NOT EXISTS folder_id uuid,
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

CREATE TABLE public.course_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.course_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_materials
  ADD CONSTRAINT course_materials_folder_fk FOREIGN KEY (folder_id) REFERENCES public.course_folders(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_folders TO authenticated;
GRANT ALL ON public.course_folders TO service_role;
ALTER TABLE public.course_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages own folders" ON public.course_folders
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students see folders for accessible materials" ON public.course_folders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_materials cm
      JOIN public.course_material_access cma ON cma.material_id = cm.id
      WHERE cm.folder_id = course_folders.id AND cma.student_id = auth.uid()
    )
  );
CREATE TRIGGER course_folders_touch BEFORE UPDATE ON public.course_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.course_material_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(material_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_material_versions TO authenticated;
GRANT ALL ON public.course_material_versions TO service_role;
ALTER TABLE public.course_material_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages own versions" ON public.course_material_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_materials cm WHERE cm.id = course_material_versions.material_id AND (cm.tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_materials cm WHERE cm.id = course_material_versions.material_id AND (cm.tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "students view versions for granted materials" ON public.course_material_versions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_material_access cma WHERE cma.material_id = course_material_versions.material_id AND cma.student_id = auth.uid()));

-- =====================================================================
-- 6. SCHEDULING EXTENSIONS
-- =====================================================================
ALTER TABLE public.tutor_availability
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

CREATE TABLE public.tutor_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_holidays TO authenticated;
GRANT ALL ON public.tutor_holidays TO service_role;
ALTER TABLE public.tutor_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor manages own holidays" ON public.tutor_holidays
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "anyone signed in views holidays" ON public.tutor_holidays
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.session_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desired_after timestamptz,
  desired_before timestamptz,
  subject text,
  duration_min integer NOT NULL DEFAULT 60,
  notes text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_waitlist TO authenticated;
GRANT ALL ON public.session_waitlist TO service_role;
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants view waitlist row" ON public.session_waitlist
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid() OR student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "student manages own waitlist" ON public.session_waitlist
  FOR ALL TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.session_recurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rrule text NOT NULL,
  until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_recurrence TO authenticated;
GRANT ALL ON public.session_recurrence TO service_role;
ALTER TABLE public.session_recurrence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants view recurrence" ON public.session_recurrence
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_recurrence.parent_session_id AND (s.tutor_id = auth.uid() OR s.student_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "tutor manages recurrence" ON public.session_recurrence
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_recurrence.parent_session_id AND (s.tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_recurrence.parent_session_id AND (s.tutor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =====================================================================
-- 7. Parent RPCs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_my_children()
 RETURNS TABLE(child_id uuid, full_name text, relationship text, status text, linked_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pcl.child_id, COALESCE(p.full_name,'Student'), pcl.relationship, pcl.status, pcl.created_at
  FROM public.parent_child_links pcl
  LEFT JOIN public.profiles p ON p.id = pcl.child_id
  WHERE pcl.parent_id = auth.uid()
  ORDER BY pcl.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_child_invite(_token text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _inv record; _link_id uuid;
BEGIN
  SELECT * INTO _inv FROM public.child_invites
    WHERE token = _token AND status = 'pending' AND expires_at > now() LIMIT 1;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invalid or expired invite'; END IF;
  INSERT INTO public.parent_child_links (parent_id, child_id, status)
  VALUES (_inv.parent_id, auth.uid(), 'active')
  ON CONFLICT (parent_id, child_id) DO UPDATE SET status = 'active'
  RETURNING id INTO _link_id;
  UPDATE public.child_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = _inv.id;
  RETURN _link_id;
END;
$$;

-- =====================================================================
-- 8. Compute commission for a session
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_commission_cents(_amount_cents integer, _tutor uuid, _subject text DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _rule record; _result integer;
BEGIN
  SELECT * INTO _rule FROM public.commission_rules
    WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
      AND scope = 'tutor' AND target_id = _tutor
    ORDER BY active_from DESC LIMIT 1;
  IF _rule.id IS NULL AND _subject IS NOT NULL THEN
    SELECT * INTO _rule FROM public.commission_rules
      WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
        AND scope = 'subject' AND target_text = _subject
      ORDER BY active_from DESC LIMIT 1;
  END IF;
  IF _rule.id IS NULL THEN
    SELECT * INTO _rule FROM public.commission_rules
      WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
        AND scope = 'global'
      ORDER BY active_from DESC LIMIT 1;
  END IF;
  IF _rule.id IS NULL THEN RETURN 0; END IF;
  IF _rule.method = 'percent' THEN
    _result := round(_amount_cents * _rule.percent / 100.0);
  ELSIF _rule.method = 'fixed' THEN
    _result := _rule.fixed_cents;
  ELSE
    _result := round(_amount_cents * _rule.percent / 100.0) + _rule.fixed_cents;
  END IF;
  RETURN _result;
END;
$$;
