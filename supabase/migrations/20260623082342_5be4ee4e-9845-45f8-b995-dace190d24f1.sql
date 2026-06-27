
DROP FUNCTION IF EXISTS public.admin_record_manual_intent(uuid, uuid, uuid, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_record_manual_intent(
  _student uuid,
  _tutor uuid,
  _gross_cents int,
  _currency text DEFAULT 'USD',
  _method text DEFAULT 'manual',
  _session uuid DEFAULT NULL,
  _subject text DEFAULT NULL
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

REVOKE EXECUTE ON FUNCTION public.admin_record_manual_intent(uuid, uuid, integer, text, text, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_manual_intent(uuid, uuid, integer, text, text, uuid, text) TO authenticated;
