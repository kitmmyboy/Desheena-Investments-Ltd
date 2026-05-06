-- v2: Add compose_complaint_sms helper and improve message composition
CREATE OR REPLACE FUNCTION public.compose_complaint_sms(
  p_complaint_id UUID,
  p_new_status   TEXT,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_ref text;
  v_msg text;
BEGIN
  -- Use first 8 chars of UUID as a short reference
  v_ref := upper(left(p_complaint_id::text, 8));

  IF p_new_status = 'in_progress' THEN
    v_msg := 'Your complaint (ref: ' || v_ref || ') is now being investigated. We''ll update you when resolved. - Desheena Investments';

  ELSIF p_new_status = 'resolved' THEN
    IF p_resolution_notes IS NOT NULL AND length(trim(p_resolution_notes)) > 0 THEN
      v_msg := 'Your complaint (ref: ' || v_ref || ') has been resolved. ' || trim(p_resolution_notes) || '. Thank you. - Desheena Investments';
    ELSE
      v_msg := 'Your complaint (ref: ' || v_ref || ') has been resolved. Thank you. - Desheena Investments';
    END IF;

  ELSE
    -- Generic fallback for any other status transition (e.g. re-opened)
    v_msg := 'Your complaint (ref: ' || v_ref || ') status has been updated to ' || p_new_status || '. - Desheena Investments';
  END IF;

  RETURN v_msg;
END;
$$;

-- Replace trigger function to use compose_complaint_sms
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
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT phone
    INTO v_client_phone
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client_phone IS NULL OR trim(v_client_phone) = '' THEN
    RETURN NEW;
  END IF;

  v_message := public.compose_complaint_sms(NEW.id, NEW.status, NEW.resolution_notes);

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
