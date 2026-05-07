-- Add notes column to clients table
-- This column is used by CSV import and should be available in the UI
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS notes TEXT;
