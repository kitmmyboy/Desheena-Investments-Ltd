
-- ============================================================
-- Revoke public EXECUTE on trigger functions
-- These are SECURITY DEFINER trigger functions that should not
-- be callable directly via the REST API.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres;

REVOKE EXECUTE ON FUNCTION public.handle_auth_user_audit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_audit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_audit() TO postgres;
;
