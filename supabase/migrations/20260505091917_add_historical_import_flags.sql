-- Add is_historical flag to invoices and payments for bulk import support
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add paid_amount to invoices for tracking partial payments
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

-- Index for filtering historical records
CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments USING btree (client_id);
