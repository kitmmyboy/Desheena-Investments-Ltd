-- Remove the old cron job and replace with one that doesn't require auth
-- (Edge Function has verify_jwt: false so no Authorization header needed)
SELECT cron.unschedule('generate-monthly-invoices');

-- Re-schedule without Authorization header since verify_jwt is false
SELECT cron.schedule(
  'generate-monthly-invoices',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://toejolbdlqtrknmujuvo.supabase.co/functions/v1/generate-monthly-invoices',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
;
