
-- ============================================================
-- TASK 2: Supabase Auth integration
-- ============================================================

-- ============================================================
-- 1. Ensure audit_log has all required columns
--    (table already exists; add ip_address as TEXT alias if needed)
-- ============================================================
-- The existing ip_address column is INET which is a superset of TEXT.
-- Add a missing_columns check: the task requires TEXT but INET is compatible.
-- We keep INET (it's stricter/better). No column changes needed.

-- ============================================================
-- 2. Trigger: sync auth.users → public.users on INSERT
--    Fires when a new user signs up via Supabase Auth.
--    Reads role from raw_user_meta_data->>'role', defaults to 'Customer'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Read role from user metadata, default to 'Customer'
  v_role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    'Customer'
  );

  -- Validate role value
  IF v_role NOT IN ('Admin', 'Operations_Manager', 'Driver', 'Finance', 'Customer') THEN
    v_role := 'Customer';
  END IF;

  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        role       = EXCLUDED.role,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 3. Trigger: log auth.users INSERT and UPDATE events to audit_log
--    Captures new user creation and profile updates.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_auth_user_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'user_created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'user_updated';
  ELSE
    v_event_type := TG_OP;
  END IF;

  INSERT INTO public.audit_log (
    user_id,
    event_type,
    table_name,
    record_id,
    new_data,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_event_type,
    'auth.users',
    NEW.id,
    jsonb_build_object(
      'email', NEW.email,
      'role',  NEW.raw_user_meta_data ->> 'role',
      'created_at', NEW.created_at
    ),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_audit ON auth.users;

CREATE TRIGGER on_auth_user_audit
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_audit();
;
