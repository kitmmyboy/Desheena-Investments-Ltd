-- Security hardening: use app.supabase_url GUC with fallback, add logging
CREATE OR REPLACE FUNCTION public.notify_client_on_complaint_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_phone  text;
  v_message       text;
  v_supabase_url  text;
  v_payload       jsonb;
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Look up the client's phone number
  SELECT phone
    INTO v_client_phone
    FROM public.clients
   WHERE id = NEW.client_id;

  -- If no phone number is registered, skip silently
  IF v_client_phone IS NULL OR trim(v_client_phone) = '' THEN
    RAISE LOG '[complaint_sms] No phone for client_id=%, complaint_id=%. Skipping SMS.',
              NEW.client_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Compose the SMS message
  v_message := public.compose_complaint_sms(
    NEW.id,
    NEW.status,
    NEW.resolution_notes
  );

  -- Use the hardcoded project URL (single-project deployment)
  -- Override via GUC app.supabase_url if needed
  v_supabase_url := current_setting('app.supabase_url', true);
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://toejolbdlqtrknmujuvo.supabase.co';
  END IF;

  -- Build the JSON payload for the complaint-status-sms Edge Function
  -- This function has verify_jwt=false so no Authorization header is needed
  v_payload := jsonb_build_object(
    'phone',        v_client_phone,
    'message',      v_message,
    'complaint_id', NEW.id::text
  );

  -- Fire-and-forget async HTTP POST via pg_net
  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/complaint-status-sms',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := v_payload
  );

  RAISE LOG '[complaint_sms] Queued SMS for complaint_id=%, client_id=%, status_change=%->%',
            NEW.id, NEW.client_id, OLD.status, NEW.status;

  RETURN NEW;
END;
$$;
