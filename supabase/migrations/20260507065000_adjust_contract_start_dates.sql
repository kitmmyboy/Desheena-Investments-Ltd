-- Migration to adjust contract start dates based on the first recorded payment
-- For any contract that has associated payments, we update the start_date
-- to match the date of the earliest completed payment.
-- This prevents the system from generating large unpaid invoice backlogs (e.g., from December)
-- when billing should realistically only start from the first payment date.

DO $$
BEGIN
    UPDATE public.contracts c
    SET start_date = first_payments.first_payment_date
    FROM (
        SELECT client_id, MIN(paid_at)::date AS first_payment_date
        FROM public.payments
        WHERE status = 'completed' AND paid_at IS NOT NULL
        GROUP BY client_id
    ) AS first_payments
    WHERE c.client_id = first_payments.client_id
      AND c.start_date != first_payments.first_payment_date;
END $$;
