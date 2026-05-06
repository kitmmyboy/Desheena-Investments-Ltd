
-- 1. Create collection_schedules table
CREATE TABLE IF NOT EXISTS public.collection_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
  specific_date DATE, -- For one-off or irregular collections
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for scheduling lookups
CREATE INDEX IF NOT EXISTS idx_collection_schedules_client_id ON public.collection_schedules(client_id);

-- Trigger for updated_at
CREATE TRIGGER trg_collection_schedules_updated_at
BEFORE UPDATE ON public.collection_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add RLS to collection_schedules
ALTER TABLE public.collection_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can see their own schedules
CREATE POLICY "Clients can view their own schedules" ON public.collection_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.client_id = collection_schedules.client_id
    )
  );

-- Policy: Drivers can see schedules for their routes
CREATE POLICY "Drivers can view their route schedules" ON public.collection_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.route_clients rc
      JOIN public.route_drivers rd ON rc.route_id = rd.route_id
      WHERE rd.driver_id = auth.uid()
        AND rc.client_id = collection_schedules.client_id
    )
  );

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage schedules" ON public.collection_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('Admin', 'Operations_Manager')
    )
  );

-- 3. Update handle_new_auth_user trigger to support linking client_id via metadata
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_client_id UUID;
BEGIN
  -- Read role from user metadata, default to 'Customer'
  v_role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    'Customer'
  );

  -- Read client_id if provided
  v_client_id := (NEW.raw_user_meta_data ->> 'client_id')::UUID;

  -- Validate role value
  IF v_role NOT IN ('Admin', 'Operations_Manager', 'Driver', 'Finance', 'Customer') THEN
    v_role := 'Customer';
  END IF;

  INSERT INTO public.users (id, email, role, client_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_client_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        role       = EXCLUDED.role,
        client_id  = COALESCE(EXCLUDED.client_id, users.client_id),
        updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 5. Add user_id to notifications table if missing and rename is_dismissed to is_read for consistency
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Schedule the reminder check daily at 6 AM via pg_cron
-- Note: This requires pg_net and pg_cron extensions to be enabled.
-- It calls the check-upcoming-collections edge function.
SELECT cron.schedule(
  'collection-reminders',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := (SELECT value FROM public.system_settings WHERE key = 'supabase_url') || '/functions/v1/check-upcoming-collections',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.system_settings WHERE key = 'supabase_service_role_key')
    )
  )$$
);
