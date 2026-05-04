
-- ============================================================
-- 1. Add missing indexes for unindexed foreign keys
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON public.complaints(submitted_by);
CREATE INDEX IF NOT EXISTS idx_complaints_resolver_id  ON public.complaints(resolver_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_id    ON public.invoices(contract_id);

-- ============================================================
-- 2. Fix search_path on functions (security hardening)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql
   STABLE
   SECURITY DEFINER
   SET search_path = public, auth;

-- ============================================================
-- 3. Revoke public EXECUTE on get_user_role (it's only used
--    internally by RLS policies, not as a public API endpoint)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM authenticated;
-- Grant it back to the postgres role so RLS policies can call it
GRANT EXECUTE ON FUNCTION public.get_user_role() TO postgres;
;
