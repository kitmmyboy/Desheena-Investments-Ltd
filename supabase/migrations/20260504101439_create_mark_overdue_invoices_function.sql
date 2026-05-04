-- Function: mark_overdue_invoices()
-- Updates all invoices where due_date < now() AND status = 'unpaid' to status = 'overdue'
-- Returns the count of updated invoices
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE due_date < NOW()
    AND status = 'unpaid';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;;
