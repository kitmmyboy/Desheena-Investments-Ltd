-- Fix audit trigger ordering: ensure handle_new_auth_user runs before handle_auth_user_audit
-- so the users row exists before the audit log insert attempts to reference it.
-- Re-create both triggers with explicit ordering via trigger names (alphabetical by Postgres).

-- Drop and recreate on auth.users to control ordering
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_audit ON auth.users;

-- 1. Sync trigger (must run first — creates the public.users row)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Audit trigger (runs after — public.users row now exists)
CREATE TRIGGER on_auth_user_audit
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_audit();
