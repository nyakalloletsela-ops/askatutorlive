
REVOKE EXECUTE ON FUNCTION public.tutor_balance(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.payments_admin_overview() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_payout_run(date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_mark_payout_item_paid(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_mark_payout_item_failed(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_refund_intent(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_record_manual_intent(uuid, uuid, uuid, integer, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payments_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_payout_run(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_payout_item_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_payout_item_failed(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_intent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_manual_intent(uuid, uuid, uuid, integer, text, text, text) TO authenticated;
