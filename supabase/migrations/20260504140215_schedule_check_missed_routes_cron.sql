-- Schedule daily cron job to check for missed routes (runs at 11:00 UTC)
SELECT cron.schedule(
  'check-missed-routes',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/check-missed-routes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
