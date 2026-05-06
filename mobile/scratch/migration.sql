
-- New table for specific collection schedules
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

-- Add RLS to collection_schedules
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

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage schedules" ON public.collection_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('Admin', 'Operations_Manager')
    )
  );
