-- Schedule a daily cron job at 01:00 UTC to mark overdue invoices
-- pg_cron runs SQL directly
SELECT cron.schedule(
  'mark-overdue-invoices-daily',
  '0 1 * * *',
  'SELECT public.mark_overdue_invoices();'
);;
