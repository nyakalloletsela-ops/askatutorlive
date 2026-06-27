
CREATE TABLE public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.tutor_courses(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'video',
  storage_path text,
  external_url text,
  duration_sec int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_material_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.course_materials(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_materials TO authenticated;
GRANT ALL ON public.course_materials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_material_access TO authenticated;
GRANT ALL ON public.course_material_access TO service_role;

ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_material_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor inserts own course material"
  ON public.course_materials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));

CREATE POLICY "tutor updates own course material"
  ON public.course_materials FOR UPDATE TO authenticated
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tutor deletes own course material"
  ON public.course_materials FOR DELETE TO authenticated
  USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "view granted course material"
  ON public.course_materials FOR SELECT TO authenticated
  USING (
    auth.uid() = tutor_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.course_material_access cma
      WHERE cma.material_id = course_materials.id AND cma.student_id = auth.uid()
    )
  );

CREATE TRIGGER course_materials_touch
  BEFORE UPDATE ON public.course_materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "owner manages access"
  ON public.course_material_access FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.course_materials m
               WHERE m.id = course_material_access.material_id AND m.tutor_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.course_materials m
               WHERE m.id = course_material_access.material_id AND m.tutor_id = auth.uid())
  );

CREATE POLICY "student reads own access row"
  ON public.course_material_access FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE INDEX course_material_access_student_idx ON public.course_material_access(student_id);
CREATE INDEX course_material_access_material_idx ON public.course_material_access(material_id);

CREATE POLICY "admin insert student sub"
  ON public.student_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete student sub"
  ON public.student_subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin insert tutor sub"
  ON public.tutor_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete tutor sub"
  ON public.tutor_subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
