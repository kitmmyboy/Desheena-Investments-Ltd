-- Update payment_method check constraint to include 'adjustment'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('pesapal', 'manual', 'bank_transfer', 'mobile_money', 'adjustment'));
