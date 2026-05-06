-- Ensure service_frequency column on clients accepts the expected text values
-- (was previously constrained; this migration relaxes or corrects the type)
ALTER TABLE public.clients
  ALTER COLUMN service_frequency TYPE TEXT;

-- Add division_office column if not present (used for client grouping)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS division_office TEXT;
