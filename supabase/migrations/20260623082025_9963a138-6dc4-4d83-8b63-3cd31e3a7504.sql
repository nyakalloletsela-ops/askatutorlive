
-- 1. PAYMENT PROVIDERS
CREATE TABLE public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  priority int NOT NULL DEFAULT 100,
  supported_methods text[] NOT NULL DEFAULT '{}',
  supported_currencies text[] NOT NULL DEFAULT '{}',
  supported_countries text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers readable by authenticated" ON public.payment_providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers admin write" ON public.payment_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_providers_touch
  BEFORE UPDATE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. TUTOR LEVELS  (+ profiles.tutor_level)
CREATE TABLE public.tutor_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  commission_percent numeric(5,2) NOT NULL DEFAULT 20.00,
  min_completed_sessions int NOT NULL DEFAULT 0,
  perks jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tutor_levels TO authenticated;
GRANT ALL ON public.tutor_levels TO service_role;
ALTER TABLE public.tutor_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutor_levels readable" ON public.tutor_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tutor_levels admin write" ON public.tutor_levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_tutor_levels_touch
  BEFORE UPDATE ON public.tutor_levels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.tutor_levels (slug, display_name, commission_percent, min_completed_sessions, sort_order) VALUES
  ('bronze',   'Bronze',   25.00, 0,   10),
  ('silver',   'Silver',   20.00, 25,  20),
  ('gold',     'Gold',     15.00, 100, 30),
  ('platinum', 'Platinum', 10.00, 500, 40);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutor_level text NOT NULL DEFAULT 'bronze'
    REFERENCES public.tutor_levels(slug) ON UPDATE CASCADE;

-- 3. EXTEND commission_rules SCOPE
ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS commission_rules_scope_check;
ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_scope_check
  CHECK (scope = ANY (ARRAY['global','tutor','tutor_level','subject','promo']));

CREATE OR REPLACE FUNCTION public.compute_commission_cents(_amount_cents integer, _tutor uuid, _subject text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE _rule record; _result integer; _level text; _level_pct numeric;
BEGIN
  SELECT * INTO _rule FROM public.commission_rules
    WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
      AND scope='tutor' AND target_id=_tutor
    ORDER BY active_from DESC LIMIT 1;

  IF _rule.id IS NULL THEN
    SELECT tutor_level INTO _level FROM public.profiles WHERE id=_tutor;
    IF _level IS NOT NULL THEN
      SELECT * INTO _rule FROM public.commission_rules
        WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
          AND scope='tutor_level' AND target_text=_level
        ORDER BY active_from DESC LIMIT 1;
      IF _rule.id IS NULL THEN
        SELECT commission_percent INTO _level_pct FROM public.tutor_levels WHERE slug=_level;
        IF _level_pct IS NOT NULL THEN
          RETURN round(_amount_cents * _level_pct / 100.0);
        END IF;
      END IF;
    END IF;
  END IF;

  IF _rule.id IS NULL AND _subject IS NOT NULL THEN
    SELECT * INTO _rule FROM public.commission_rules
      WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
        AND scope='subject' AND target_text=_subject
      ORDER BY active_from DESC LIMIT 1;
  END IF;

  IF _rule.id IS NULL THEN
    SELECT * INTO _rule FROM public.commission_rules
      WHERE is_active AND active_from <= now() AND (active_to IS NULL OR active_to > now())
        AND scope='global'
      ORDER BY active_from DESC LIMIT 1;
  END IF;

  IF _rule.id IS NULL THEN RETURN 0; END IF;
  IF _rule.method='percent' THEN
    _result := round(_amount_cents * _rule.percent / 100.0);
  ELSIF _rule.method='fixed' THEN
    _result := _rule.fixed_cents;
  ELSE
    _result := round(_amount_cents * _rule.percent / 100.0) + _rule.fixed_cents;
  END IF;
  RETURN _result;
END;
$fn$;

-- 4. PLATFORM CONFIG — add hold window column
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS payout_hold_hours int NOT NULL DEFAULT 72;

-- 5. PAYMENT INTENTS
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_ref text,
  method text,
  gross_cents integer NOT NULL CHECK (gross_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
  tutor_net_cents integer NOT NULL DEFAULT 0 CHECK (tutor_net_cents >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','refunded')),
  hold_until timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  succeeded_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_intents_tutor ON public.payment_intents(tutor_id, status);
CREATE INDEX idx_payment_intents_student ON public.payment_intents(student_id, status);
CREATE INDEX idx_payment_intents_status_created ON public.payment_intents(status, created_at DESC);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intents student read own" ON public.payment_intents
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "intents tutor read own" ON public.payment_intents
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY "intents admin all" ON public.payment_intents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_intents_touch
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. PAYOUT RUNS, METHODS, ITEMS
CREATE TABLE public.payout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  total_gross_cents integer NOT NULL DEFAULT 0,
  total_commission_cents integer NOT NULL DEFAULT 0,
  total_net_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (period_start, period_end)
);
GRANT SELECT ON public.payout_runs TO authenticated;
GRANT ALL ON public.payout_runs TO service_role;
ALTER TABLE public.payout_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_runs admin all" ON public.payout_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payout_runs_touch
  BEFORE UPDATE ON public.payout_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  type text NOT NULL CHECK (type IN ('bank','mobile_money','card','other')),
  display_label text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_methods_tutor ON public.payment_methods(tutor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_methods owner all" ON public.payment_methods
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid()) WITH CHECK (tutor_id = auth.uid());
CREATE POLICY "payment_methods admin read" ON public.payment_methods
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_methods_touch
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  gross_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  provider text,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  provider_transfer_ref text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payout_run_id, tutor_id)
);
CREATE INDEX idx_payout_items_run ON public.payout_items(payout_run_id);
CREATE INDEX idx_payout_items_tutor ON public.payout_items(tutor_id, status);
GRANT SELECT ON public.payout_items TO authenticated;
GRANT ALL ON public.payout_items TO service_role;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_items tutor read own" ON public.payout_items
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY "payout_items admin all" ON public.payout_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payout_items_touch
  BEFORE UPDATE ON public.payout_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. LEDGER (append-only, server-only writes)
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  balance_type text NOT NULL CHECK (balance_type IN ('platform','tutor_earnings','refunds','payout')),
  user_id uuid REFERENCES auth.users(id),
  tutor_id uuid REFERENCES auth.users(id),
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  payout_item_id uuid REFERENCES public.payout_items(id) ON DELETE RESTRICT,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_tutor ON public.ledger_entries(tutor_id, balance_type);
CREATE INDEX idx_ledger_intent ON public.ledger_entries(payment_intent_id);
CREATE INDEX idx_ledger_payout_item ON public.ledger_entries(payout_item_id);
CREATE INDEX idx_ledger_created ON public.ledger_entries(created_at DESC);
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger tutor read own" ON public.ledger_entries
  FOR SELECT TO authenticated USING (tutor_id = auth.uid());
CREATE POLICY "ledger admin read" ON public.ledger_entries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.ledger_block_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$;
CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_block_mutation();
CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_block_mutation();

-- 8. DERIVED BALANCES
CREATE OR REPLACE FUNCTION public.tutor_balance(_tutor uuid)
RETURNS TABLE (
  earned_cents bigint,
  paid_out_cents bigint,
  pending_cents bigint,
  payable_cents bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _hold_hours int;
BEGIN
  IF _tutor <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT payout_hold_hours INTO _hold_hours FROM public.platform_config WHERE id=1;
  _hold_hours := COALESCE(_hold_hours, 72);

  RETURN QUERY
  WITH le AS (
    SELECT * FROM public.ledger_entries
    WHERE tutor_id = _tutor AND balance_type='tutor_earnings'
  )
  SELECT
    COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_cents END),0)::bigint,
    COALESCE(SUM(CASE WHEN entry_type='debit' AND payout_item_id IS NOT NULL
                      THEN amount_cents END),0)::bigint,
    COALESCE(SUM(CASE WHEN entry_type='credit'
                       AND created_at > now() - make_interval(hours => _hold_hours)
                      THEN amount_cents
                      WHEN entry_type='debit'
                       AND created_at > now() - make_interval(hours => _hold_hours)
                      THEN -amount_cents END),0)::bigint,
    (COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_cents
                       WHEN entry_type='debit' THEN -amount_cents END),0)
     - COALESCE(SUM(CASE WHEN created_at > now() - make_interval(hours => _hold_hours)
                          AND entry_type='credit' THEN amount_cents
                         WHEN created_at > now() - make_interval(hours => _hold_hours)
                          AND entry_type='debit' THEN -amount_cents END),0)
    )::bigint
  FROM le;
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_admin_overview()
RETURNS TABLE (
  total_volume_cents bigint,
  total_revenue_cents bigint,
  succeeded_count int,
  pending_payout_cents bigint,
  failed_transfers int,
  refunded_cents bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(gross_cents) FROM public.payment_intents WHERE status='succeeded'),0)::bigint,
    COALESCE((SELECT SUM(commission_cents) FROM public.payment_intents WHERE status='succeeded'),0)::bigint,
    COALESCE((SELECT COUNT(*) FROM public.payment_intents WHERE status='succeeded'),0)::int,
    COALESCE((SELECT SUM(net_cents) FROM public.payout_items WHERE status IN ('pending','processing')),0)::bigint,
    COALESCE((SELECT COUNT(*) FROM public.payout_items WHERE status='failed'),0)::int,
    COALESCE((SELECT SUM(gross_cents) FROM public.payment_intents WHERE status='refunded'),0)::bigint;
END;
$$;

-- 9. ADMIN WRITE FUNCTIONS
CREATE OR REPLACE FUNCTION public.admin_create_payout_run(_period_start date DEFAULT NULL, _period_end date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _run uuid; _start date; _end date; _hold_hours int; _cutoff timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT payout_hold_hours INTO _hold_hours FROM public.platform_config WHERE id=1;
  _hold_hours := COALESCE(_hold_hours,72);
  _cutoff := now() - make_interval(hours => _hold_hours);

  IF _period_start IS NULL OR _period_end IS NULL THEN
    _start := (date_trunc('week', now())::date) - 7;
    _end := _start + 6;
  ELSE
    _start := _period_start; _end := _period_end;
  END IF;

  INSERT INTO public.payout_runs (period_start, period_end, status, created_by)
  VALUES (_start, _end, 'pending', auth.uid())
  ON CONFLICT (period_start, period_end) DO UPDATE SET status='pending'
  RETURNING id INTO _run;

  WITH eligible AS (
    SELECT pi.tutor_id,
           SUM(pi.gross_cents)::int       AS gross,
           SUM(pi.commission_cents)::int  AS commission,
           SUM(pi.tutor_net_cents)::int   AS net,
           MAX(pi.currency)               AS currency
    FROM public.payment_intents pi
    WHERE pi.status='succeeded'
      AND pi.succeeded_at IS NOT NULL
      AND pi.succeeded_at <= _cutoff
      AND pi.succeeded_at::date BETWEEN _start AND _end
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.payment_intent_id=pi.id
          AND le.balance_type='tutor_earnings' AND le.entry_type='debit'
          AND le.payout_item_id IS NOT NULL
      )
    GROUP BY pi.tutor_id
  )
  INSERT INTO public.payout_items (payout_run_id, tutor_id, gross_cents, commission_cents, net_cents, currency, status)
  SELECT _run, tutor_id, gross, commission, net, currency, 'pending'
  FROM eligible
  ON CONFLICT (payout_run_id, tutor_id) DO NOTHING;

  UPDATE public.payout_runs r SET
    total_gross_cents = COALESCE((SELECT SUM(gross_cents) FROM public.payout_items WHERE payout_run_id=_run),0),
    total_commission_cents = COALESCE((SELECT SUM(commission_cents) FROM public.payout_items WHERE payout_run_id=_run),0),
    total_net_cents = COALESCE((SELECT SUM(net_cents) FROM public.payout_items WHERE payout_run_id=_run),0)
  WHERE r.id=_run;

  RETURN _run;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_payout_item_paid(_item uuid, _provider_ref text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _it record; _intent record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _it FROM public.payout_items WHERE id=_item FOR UPDATE;
  IF _it.id IS NULL THEN RAISE EXCEPTION 'Payout item not found'; END IF;
  IF _it.status='paid' THEN RETURN; END IF;

  FOR _intent IN
    SELECT pi.* FROM public.payment_intents pi
    JOIN public.payout_runs r ON r.id=_it.payout_run_id
    WHERE pi.tutor_id=_it.tutor_id
      AND pi.status='succeeded'
      AND pi.succeeded_at::date BETWEEN r.period_start AND r.period_end
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.payment_intent_id=pi.id
          AND le.balance_type='tutor_earnings' AND le.entry_type='debit'
      )
  LOOP
    INSERT INTO public.ledger_entries
      (entry_type, amount_cents, currency, balance_type, tutor_id, payment_intent_id, payout_item_id, description)
    VALUES
      ('debit', _intent.tutor_net_cents, _intent.currency, 'tutor_earnings',
       _intent.tutor_id, _intent.id, _it.id, 'Payout settled');
  END LOOP;

  INSERT INTO public.ledger_entries
    (entry_type, amount_cents, currency, balance_type, tutor_id, payout_item_id, description, metadata)
  VALUES
    ('credit', _it.net_cents, _it.currency, 'payout', _it.tutor_id, _it.id,
     'Payout sent', jsonb_build_object('provider_ref', _provider_ref));

  UPDATE public.payout_items
  SET status='paid', paid_at=now(),
      provider_transfer_ref=COALESCE(_provider_ref, provider_transfer_ref)
  WHERE id=_item;

  UPDATE public.payout_runs r SET status='completed', completed_at=now()
  WHERE r.id=_it.payout_run_id
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_items WHERE payout_run_id=r.id AND status IN ('pending','processing')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_payout_item_failed(_item uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.payout_items SET status='failed', failure_reason=_reason WHERE id=_item;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_refund_intent(_intent uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pi record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _pi FROM public.payment_intents WHERE id=_intent FOR UPDATE;
  IF _pi.id IS NULL THEN RAISE EXCEPTION 'Intent not found'; END IF;
  IF _pi.status <> 'succeeded' THEN RAISE EXCEPTION 'Only succeeded intents can be refunded'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_entries
             WHERE payment_intent_id=_pi.id AND balance_type='tutor_earnings'
               AND entry_type='debit' AND payout_item_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Already paid out — refund must be issued offline';
  END IF;

  INSERT INTO public.ledger_entries (entry_type, amount_cents, currency, balance_type, payment_intent_id, description)
  VALUES ('debit', _pi.gross_cents, _pi.currency, 'platform', _pi.id, COALESCE(_reason,'Refund'));
  INSERT INTO public.ledger_entries (entry_type, amount_cents, currency, balance_type, tutor_id, payment_intent_id, description)
  VALUES ('debit', _pi.tutor_net_cents, _pi.currency, 'tutor_earnings', _pi.tutor_id, _pi.id, COALESCE(_reason,'Refund'));
  INSERT INTO public.ledger_entries (entry_type, amount_cents, currency, balance_type, payment_intent_id, description)
  VALUES ('credit', _pi.gross_cents, _pi.currency, 'refunds', _pi.id, COALESCE(_reason,'Refund'));

  UPDATE public.payment_intents
  SET status='refunded', refunded_at=now(),
      metadata = metadata || jsonb_build_object('refund_reason', _reason)
  WHERE id=_intent;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_manual_intent(
  _student uuid, _tutor uuid, _session uuid, _gross_cents int,
  _currency text DEFAULT 'USD', _method text DEFAULT 'manual', _subject text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _commission int; _net int; _hold int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  _commission := public.compute_commission_cents(_gross_cents, _tutor, _subject);
  _net := _gross_cents - _commission;
  SELECT payout_hold_hours INTO _hold FROM public.platform_config WHERE id=1;
  _hold := COALESCE(_hold,72);

  INSERT INTO public.payment_intents
    (student_id, tutor_id, session_id, provider, method, gross_cents, currency,
     commission_cents, tutor_net_cents, status, succeeded_at, hold_until)
  VALUES
    (_student, _tutor, _session, 'manual', _method, _gross_cents, _currency,
     _commission, _net, 'succeeded', now(), now() + make_interval(hours => _hold))
  RETURNING id INTO _id;

  INSERT INTO public.ledger_entries (entry_type, amount_cents, currency, balance_type, payment_intent_id, description)
  VALUES ('credit', _gross_cents, _currency, 'platform', _id, 'Manual payment recorded');
  INSERT INTO public.ledger_entries (entry_type, amount_cents, currency, balance_type, tutor_id, payment_intent_id, description)
  VALUES ('credit', _net, _currency, 'tutor_earnings', _tutor, _id, 'Tutor earnings (manual)');

  RETURN _id;
END;
$$;

-- Seed provider rows so admin can flip them on later.
INSERT INTO public.payment_providers (slug, display_name, is_enabled, priority, supported_methods, supported_currencies, supported_countries) VALUES
  ('paystack', 'Paystack', false, 10,
    ARRAY['card','bank','mobile_money','ussd','bank_transfer'],
    ARRAY['NGN','GHS','KES','ZAR','USD'],
    ARRAY['NG','GH','KE','ZA']),
  ('flutterwave', 'Flutterwave', false, 20,
    ARRAY['card','bank','mobile_money','ussd','bank_transfer'],
    ARRAY['NGN','GHS','KES','UGX','TZS','RWF','XOF','XAF','ZMW','USD'],
    ARRAY['NG','GH','KE','UG','TZ','RW','CI','SN','CM','ZM']),
  ('mpesa', 'M-Pesa (direct)', false, 30,
    ARRAY['mobile_money'], ARRAY['KES','TZS'], ARRAY['KE','TZ']),
  ('manual', 'Manual / Bank transfer', true, 99,
    ARRAY['bank_transfer','cash'], ARRAY['USD','KES','NGN','ZAR','GHS','EUR','GBP'], ARRAY['*'])
ON CONFLICT (slug) DO NOTHING;
