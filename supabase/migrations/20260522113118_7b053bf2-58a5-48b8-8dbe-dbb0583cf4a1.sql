
-- Editable site copy ("stories") shown across the homepage and other public pages.
CREATE TABLE public.site_content (
  key TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  multiline BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads site content"
  ON public.site_content FOR SELECT USING (true);

CREATE POLICY "admins write site content"
  ON public.site_content FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_site_content_touch
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default copy. Admins can edit any of these in the admin panel.
INSERT INTO public.site_content (key, section, label, value, multiline, sort_order) VALUES
  ('hero.badge',        'Hero',           'Hero badge',          'Online tutoring marketplace', false, 10),
  ('hero.title',        'Hero',           'Hero title',          'Learn from verified tutors, one lesson at a time.', false, 20),
  ('hero.title_accent', 'Hero',           'Hero accent (last words, shown in colour)', 'one lesson at a time.', false, 25),
  ('hero.subtitle',     'Hero',           'Hero subtitle',       'Book live one-on-one sessions with expert tutors for Primary, High School, IGCSE, A-Level and Undergraduate subjects.', true, 30),
  ('hero.cta_primary',  'Hero',           'Primary CTA label',   'Find a tutor', false, 40),
  ('hero.cta_secondary','Hero',           'Secondary CTA label', 'Create free account', false, 50),

  ('shortcuts.find.title',  'Shortcuts', 'Find tutor title',  'Find a Tutor', false, 10),
  ('shortcuts.find.desc',   'Shortcuts', 'Find tutor story',  'Browse verified tutors by subject and book a live session.', true, 15),
  ('shortcuts.tutor.title', 'Shortcuts', 'Become a tutor title', 'Become a Tutor', false, 20),
  ('shortcuts.tutor.desc',  'Shortcuts', 'Become a tutor story', 'Apply to join, list your subjects, and start earning.', true, 25),
  ('shortcuts.dash.title',  'Shortcuts', 'Dashboard title',   'Dashboard', false, 30),
  ('shortcuts.dash.desc',   'Shortcuts', 'Dashboard story',   'Manage your sessions, bookings and profile.', true, 35),

  ('tutors.heading',    'Tutors section', 'Tutors heading',    'Available tutors', false, 10),
  ('tutors.subheading', 'Tutors section', 'Tutors subheading', 'Premium Certified Tutors appear first. Search by name or filter by subject.', true, 20),
  ('tutors.top_label',  'Tutors section', 'Top tutors label',  'Top 5 most-booked tutors', false, 30),

  ('footer.tagline', 'Footer', 'Footer tagline', '© Ask A Tutor Live. All rights reserved.', false, 10);
