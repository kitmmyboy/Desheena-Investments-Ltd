-- Create staff and driver_details tables

CREATE TABLE IF NOT EXISTS public.staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  national_id     TEXT,
  role            TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'full-time',
  status          TEXT NOT NULL DEFAULT 'active',
  zone            TEXT,
  hire_date       DATE,
  user_id         UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to staff" ON public.staff
  FOR ALL
  TO authenticated
  USING (
    ((auth.jwt() ->> 'role') = 'Admin')
    OR (((auth.jwt() -> 'user_metadata') ->> 'role') = 'Admin')
  );

CREATE POLICY "Operations_Manager read update staff" ON public.staff
  FOR SELECT
  TO authenticated
  USING (((auth.jwt() -> 'user_metadata') ->> 'role') = 'Operations_Manager');

CREATE POLICY "Operations_Manager update staff" ON public.staff
  FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'user_metadata') ->> 'role') = 'Operations_Manager');

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Driver details (extends staff for drivers)
CREATE TABLE IF NOT EXISTS public.driver_details (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  license_number  TEXT,
  license_expiry  DATE,
  assigned_truck  TEXT,
  default_route_id UUID REFERENCES public.routes(id),
  device_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to driver_details" ON public.driver_details
  FOR ALL
  TO authenticated
  USING (((auth.jwt() -> 'user_metadata') ->> 'role') = 'Admin');

CREATE POLICY "Operations_Manager read driver_details" ON public.driver_details
  FOR SELECT
  TO authenticated
  USING (((auth.jwt() -> 'user_metadata') ->> 'role') = 'Operations_Manager');

CREATE TRIGGER driver_details_updated_at
  BEFORE UPDATE ON public.driver_details
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
