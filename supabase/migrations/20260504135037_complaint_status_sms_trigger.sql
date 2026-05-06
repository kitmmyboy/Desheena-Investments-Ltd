-- Trigger to send SMS when complaint status changes (initial version)
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
    RETURN NEW;
  END IF;

  -- Simple message composition
  v_message := 'Your complaint status has been updated to ' || NEW.status || '. - Desheena Investments';

  v_supabase_url := 'https://toejolbdlqtrknmujuvo.supabase.co';

  v_payload := jsonb_build_object(
    'phone',        v_client_phone,
    'message',      v_message,
    'complaint_id', NEW.id::text
  );

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/complaint-status-sms',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := v_payload
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_status_sms
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_complaint_status_change();
