-- Add registration_fee and notes columns to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS registration_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;
