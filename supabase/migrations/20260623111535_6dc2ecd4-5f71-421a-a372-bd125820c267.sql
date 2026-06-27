
-- 1. Add feature scope to plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS feature_scope text[] NOT NULL DEFAULT '{}';

-- 2. Seed student plans (idempotent by name)
INSERT INTO public.subscription_plans
  (name, audience, description, price_cents, currency, duration_unit, duration_count, features, feature_scope, is_active, sort_order)
VALUES
  ('AI Tutor', 'student', 'Unlock the AI tutor and AI study tools', 999, 'USD', 'month', 1,
   '["AI Tutor chat","AI study tools","Step-by-step guidance"]'::jsonb,
   ARRAY['ai'], true, 10),
  ('Find Tutors', 'student', 'Browse the tutor directory and book human tutors', 1499, 'USD', 'month', 1,
   '["Browse tutor directory","View tutor profiles","Book lessons","Pay tutors in bulk"]'::jsonb,
   ARRAY['find_tutors'], true, 20),
  ('Labs', 'student', 'Access interactive labs and experiments', 999, 'USD', 'month', 1,
   '["Interactive labs","Hands-on experiments"]'::jsonb,
   ARRAY['labs'], true, 30),
  ('All Access', 'student', 'Everything: AI tutor, find tutors, and labs', 2499, 'USD', 'month', 1,
   '["Everything in AI Tutor","Everything in Find Tutors","Everything in Labs"]'::jsonb,
   ARRAY['ai','find_tutors','labs'], true, 40)
ON CONFLICT DO NOTHING;

-- 3. Deactivate any tutor plans (model is now 5% commission, no fixed tutor sub)
UPDATE public.subscription_plans SET is_active = false WHERE audience = 'tutor';

-- 4. Ensure global commission is 5%
UPDATE public.commission_rules
  SET percent = 5.00
  WHERE scope = 'global' AND is_active = true;
INSERT INTO public.commission_rules (scope, method, percent, is_active, active_from, notes)
SELECT 'global','percent',5.00,true, now(), 'Default platform commission'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE scope='global' AND is_active=true);

-- 5. Prepaid lessons table
CREATE TABLE IF NOT EXISTS public.prepaid_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lessons_total integer NOT NULL CHECK (lessons_total > 0),
  lessons_remaining integer NOT NULL CHECK (lessons_remaining >= 0),
  lesson_minutes integer NOT NULL CHECK (lesson_minutes > 0),
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prepaid_lessons TO authenticated;
GRANT ALL ON public.prepaid_lessons TO service_role;

ALTER TABLE public.prepaid_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student or tutor can view own prepaid lessons"
  ON public.prepaid_lessons FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = tutor_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER prepaid_lessons_touch
  BEFORE UPDATE ON public.prepaid_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Entitlement RPCs
CREATE OR REPLACE FUNCTION public.get_my_scopes()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT s) FROM (
      SELECT unnest(p.feature_scope) AS s
      FROM public.subscription_assignments sa
      JOIN public.subscription_plans p ON p.id = sa.plan_id
      WHERE sa.user_id = auth.uid()
        AND sa.status = 'active'
        AND (sa.expires_at IS NULL OR sa.expires_at > now())
        AND p.is_active
    ) x),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.student_has_scope(_scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _scope = ANY(public.get_my_scopes());
$$;

-- 7. Tutor pricing RPC (requires find_tutors scope or admin or self)
CREATE OR REPLACE FUNCTION public.get_tutor_pricing(_tutor uuid)
RETURNS TABLE(id uuid, full_name text, hourly_rate numeric, currency text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.has_role(auth.uid(),'admin')
    OR auth.uid() = _tutor
    OR public.student_has_scope('find_tutors')
  ) THEN
    RAISE EXCEPTION 'Subscription required to view tutor pricing';
  END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(p.full_name, 'Tutor') AS full_name,
           COALESCE(p.hourly_rate, 0)::numeric AS hourly_rate,
           'USD'::text AS currency
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tutor'
    WHERE p.id = _tutor;
END;
$$;

-- 8. Create a prepaid bulk payment (manual / pending intent). Real provider capture
--    happens through existing payment flow; this records the intent + reservation.
CREATE OR REPLACE FUNCTION public.create_bulk_lesson_intent(
  _tutor uuid,
  _lessons integer,
  _lesson_minutes integer,
  _method text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _rate numeric;
  _gross integer;
  _commission integer;
  _net integer;
  _intent uuid;
BEGIN
  IF _student IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.student_has_scope('find_tutors') THEN
    RAISE EXCEPTION 'Find Tutors subscription required';
  END IF;
  IF _lessons < 1 OR _lessons > 100 THEN RAISE EXCEPTION 'Invalid lesson count'; END IF;
  IF _lesson_minutes NOT IN (30,45,60,90,120) THEN RAISE EXCEPTION 'Invalid lesson length'; END IF;

  SELECT COALESCE(hourly_rate,0)::numeric INTO _rate FROM public.profiles WHERE id = _tutor;
  IF _rate IS NULL OR _rate <= 0 THEN RAISE EXCEPTION 'Tutor has no hourly rate set'; END IF;

  _gross := round(_rate * 100 * (_lesson_minutes::numeric / 60.0) * _lessons)::int;
  _commission := public.compute_commission_cents(_gross, _tutor, NULL);
  _net := _gross - _commission;

  INSERT INTO public.payment_intents
    (student_id, tutor_id, provider, method, gross_cents, currency,
     commission_cents, tutor_net_cents, status, metadata)
  VALUES
    (_student, _tutor, _method, _method, _gross, 'USD',
     _commission, _net, 'pending',
     jsonb_build_object('kind','bulk_lessons','lessons',_lessons,'lesson_minutes',_lesson_minutes))
  RETURNING id INTO _intent;

  RETURN _intent;
END;
$$;

-- 9. Confirm bulk payment (admin / webhook) — credits prepaid_lessons
CREATE OR REPLACE FUNCTION public.confirm_bulk_lesson_intent(_intent uuid, _provider text DEFAULT 'manual', _provider_ref text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _pi record; _lessons int; _minutes int; _row uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _pi FROM public.payment_intents WHERE id = _intent FOR UPDATE;
  IF _pi.id IS NULL THEN RAISE EXCEPTION 'Intent not found'; END IF;
  IF (_pi.metadata->>'kind') <> 'bulk_lessons' THEN RAISE EXCEPTION 'Not a bulk lesson intent'; END IF;

  PERFORM public.finalize_payment_succeeded(_intent, _provider, _provider_ref);

  _lessons := (_pi.metadata->>'lessons')::int;
  _minutes := (_pi.metadata->>'lesson_minutes')::int;

  INSERT INTO public.prepaid_lessons
    (student_id, tutor_id, lessons_total, lessons_remaining, lesson_minutes,
     hourly_rate_cents, currency, payment_intent_id)
  VALUES
    (_pi.student_id, _pi.tutor_id, _lessons, _lessons, _minutes,
     CASE WHEN _lessons*_minutes>0 THEN round(_pi.gross_cents::numeric / (_lessons * (_minutes::numeric/60.0)))::int ELSE 0 END,
     _pi.currency, _intent)
  RETURNING id INTO _row;

  RETURN _row;
END;
$$;
