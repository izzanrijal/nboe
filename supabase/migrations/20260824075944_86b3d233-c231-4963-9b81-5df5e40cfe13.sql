REVOKE EXECUTE ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_case(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_case(uuid, uuid) TO authenticated;