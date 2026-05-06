-- Create driver locations table for real-time tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for driver locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can update their own location
CREATE POLICY "Drivers can update own location" ON public.driver_locations
  FOR ALL USING (auth.uid() = driver_id);

-- Admins and Operations Managers can view all driver locations
CREATE POLICY "Admins and Managers can view all driver locations" ON public.driver_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('Admin', 'Operations_Manager')
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER trg_driver_locations_updated_at
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
