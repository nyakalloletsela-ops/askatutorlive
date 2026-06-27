
CREATE POLICY "users self-assign tutor or student role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('tutor','student'));

INSERT INTO public.user_roles (user_id, role)
VALUES ('9e11e7a9-51ca-44b9-bf2a-cf56e3fcebb7','admin')
ON CONFLICT (user_id, role) DO NOTHING;

ALTER TABLE public.tutor_subscriptions ALTER COLUMN amount SET DEFAULT 250;

CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  transaction_ref text NOT NULL,
  payment_method public.pay_method NOT NULL,
  amount numeric NOT NULL DEFAULT 100,
  status public.sub_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  notes text
);

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student view own sub"
ON public.student_subscriptions FOR SELECT
USING (auth.uid() = student_id OR has_role(auth.uid(),'admin'));

CREATE POLICY "student insert own sub"
ON public.student_subscriptions FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "admin update student sub"
ON public.student_subscriptions FOR UPDATE
USING (has_role(auth.uid(),'admin'));
