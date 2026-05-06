-- Ensure sms_log indexes exist and add table comment
CREATE INDEX IF NOT EXISTS idx_sms_log_delivery_status ON public.sms_log USING btree (delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_log_recipient ON public.sms_log USING btree (recipient_phone);
CREATE INDEX IF NOT EXISTS idx_sms_log_created_at ON public.sms_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_sms_log_attempt_count ON public.sms_log USING btree (attempt_count);
CREATE INDEX IF NOT EXISTS idx_sms_log_retry_query ON public.sms_log USING btree (delivery_status, attempt_count, created_at)
  WHERE delivery_status = 'failed';

COMMENT ON TABLE public.sms_log IS
  'Logs all outbound SMS messages sent via Africa''s Talking. '
  'delivery_status: pending | sent | delivered | failed. '
  'attempt_count: number of send attempts (max 3 within 24 hours per Requirement 12.5). '
  'event_type: invoice_generated | invoice_overdue | payment_confirmed | complaint_status_changed. '
  'related_id: UUID of the related invoice, payment, or complaint record.';
