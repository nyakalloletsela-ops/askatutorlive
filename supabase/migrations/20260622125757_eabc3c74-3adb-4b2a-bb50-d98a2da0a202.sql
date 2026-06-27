
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_my_children() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_my_children() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_child_invite(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_child_invite(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.compute_commission_cents(integer, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.compute_commission_cents(integer, uuid, text) TO authenticated;
