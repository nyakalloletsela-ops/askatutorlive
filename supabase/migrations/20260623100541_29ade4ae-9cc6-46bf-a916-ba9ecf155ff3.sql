
-- 1. Extend payment_providers
ALTER TABLE public.payment_providers
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS credentials_ref text,
  ADD COLUMN IF NOT EXISTS supported_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;

ALTER TABLE public.payment_providers
  DROP CONSTRAINT IF EXISTS payment_providers_mode_check;
ALTER TABLE public.payment_providers
  ADD CONSTRAINT payment_providers_mode_check CHECK (mode IN ('sandbox','live'));

-- 2. payment_attempts
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES public.payment_intents(id) ON DELETE CASCADE,
  provider_slug text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed')),
  failure_reason text,
  latency_ms integer,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts admin read" ON public.payment_attempts;
CREATE POLICY "attempts admin read" ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_payment_attempts_intent
  ON public.payment_attempts(payment_intent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider
  ON public.payment_attempts(provider_slug, created_at DESC);

-- 3. Allow admins to add/edit providers via Data API: policy already exists,
--    but credentials_ref must never echo a raw secret — UI only stores a NAME prefix.

-- 4. Seed PayPal provider (disabled until keys arrive)
INSERT INTO public.payment_providers
  (slug, display_name, is_enabled, priority, supported_methods,
   supported_currencies, supported_countries, mode, credentials_ref, supported_regions, config)
VALUES
  ('paypal', 'PayPal', false, 10, ARRAY['card','paypal_wallet'],
   ARRAY['USD','EUR','GBP','ZAR'], ARRAY['*'], 'sandbox', 'PAYPAL',
   '["GLOBAL"]'::jsonb, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- 5. Server-side helper functions for the PaymentRouter (SECURITY DEFINER,
--    only callable by service_role since they bypass admin checks).

CREATE OR REPLACE FUNCTION public.record_payment_attempt(
  _intent uuid,
  _provider text,
  _status text,
  _failure_reason text DEFAULT NULL,
  _latency_ms integer DEFAULT NULL,
  _provider_ref text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.payment_attempts
    (payment_intent_id, provider_slug, status, failure_reason, latency_ms, provider_ref)
  VALUES (_intent, _provider, _status, _failure_reason, _latency_ms, _provider_ref)
  RETURNING id INTO _id;

  IF _status = 'success' THEN
    UPDATE public.payment_providers
      SET success_count = success_count + 1, last_success_at = now()
      WHERE slug = _provider;
  ELSE
    UPDATE public.payment_providers
      SET failure_count = failure_count + 1,
          last_failure_at = now(),
          last_error = COALESCE(_failure_reason, last_error)
      WHERE slug = _provider;
  END IF;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_attempt(uuid,text,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_attempt(uuid,text,text,text,integer,text) TO service_role;

-- 6. Finalize succeeded intent + write ledger atomically (called by webhook/return)
CREATE OR REPLACE FUNCTION public.finalize_payment_succeeded(
  _intent uuid,
  _provider text,
  _provider_ref text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pi record; _hold int;
BEGIN
  SELECT * INTO _pi FROM public.payment_intents WHERE id = _intent FOR UPDATE;
  IF _pi.id IS NULL THEN RAISE EXCEPTION 'Intent % not found', _intent; END IF;
  IF _pi.status = 'succeeded' THEN RETURN; END IF;
  IF _pi.status <> 'pending' THEN
    RAISE EXCEPTION 'Intent % cannot transition from % to succeeded', _intent, _pi.status;
  END IF;

  SELECT payout_hold_hours INTO _hold FROM public.platform_config WHERE id=1;
  _hold := COALESCE(_hold, 72);

  UPDATE public.payment_intents
    SET status='succeeded',
        succeeded_at = now(),
        provider = _provider,
        provider_ref = _provider_ref,
        hold_until = now() + make_interval(hours => _hold)
    WHERE id = _intent;

  INSERT INTO public.ledger_entries
    (entry_type, amount_cents, currency, balance_type, payment_intent_id, description, metadata)
  VALUES
    ('credit', _pi.gross_cents, _pi.currency, 'platform', _pi.id,
     'Student payment captured', jsonb_build_object('provider', _provider, 'ref', _provider_ref));

  INSERT INTO public.ledger_entries
    (entry_type, amount_cents, currency, balance_type, tutor_id, payment_intent_id, description)
  VALUES
    ('credit', _pi.tutor_net_cents, _pi.currency, 'tutor_earnings',
     _pi.tutor_id, _pi.id, 'Tutor earnings');
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_payment_succeeded(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_payment_succeeded(uuid,text,text) TO service_role;

-- 7. Mark intent failed (router moves on, but final failure is recorded)
CREATE OR REPLACE FUNCTION public.mark_payment_failed(
  _intent uuid,
  _reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_intents
    SET status='failed', failure_reason=_reason
    WHERE id=_intent AND status='pending';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_failed(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(uuid,text) TO service_role;
