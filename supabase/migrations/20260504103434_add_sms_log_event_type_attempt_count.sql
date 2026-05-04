-- Add missing columns to sms_log table for Africa's Talking SMS integration
ALTER TABLE public.sms_log
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;

-- Add a comment to clarify the relationship between columns
COMMENT ON COLUMN public.sms_log.event_type IS 'SMS trigger event: invoice_generated, invoice_overdue, payment_confirmed, complaint_status_changed';
COMMENT ON COLUMN public.sms_log.attempt_count IS 'Number of send attempts made (1 = first attempt, max 3)';
COMMENT ON COLUMN public.sms_log.africas_talking_id IS 'Africa''s Talking message ID (at_message_id)';
;
