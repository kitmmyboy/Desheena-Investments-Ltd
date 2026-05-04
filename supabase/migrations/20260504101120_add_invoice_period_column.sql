-- Add invoice_period column to invoices table (e.g., "2026-05")
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_period TEXT;

-- Backfill existing rows from period_start if present
UPDATE public.invoices
SET invoice_period = TO_CHAR(period_start, 'YYYY-MM')
WHERE invoice_period IS NULL AND period_start IS NOT NULL;
;
