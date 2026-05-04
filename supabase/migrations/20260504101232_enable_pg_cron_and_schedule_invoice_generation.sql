-- Enable pg_cron extension for job scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the generate-monthly-invoices Edge Function to run on the 1st of each month at 00:00 UTC
-- This uses pg_net to make an HTTP POST to the Edge Function
SELECT cron.schedule(
  'generate-monthly-invoices',           -- job name
  '0 0 1 * *',                           -- cron expression: first day of month at midnight UTC
  $$
  SELECT net.http_post(
    url := 'https://toejolbdlqtrknmujuvo.supabase.co/functions/v1/generate-monthly-invoices',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
;
