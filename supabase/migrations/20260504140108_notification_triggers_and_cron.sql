-- Notification triggers: new complaint + pending sync overflow
-- Also: cleanup expired notifications cron job

-- Trigger function: notify on new complaint
CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_name text;
BEGIN
  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id;

  INSERT INTO public.notifications (type, title, body, related_id, expires_at)
  VALUES (
    'new_complaint',
    'New Complaint Submitted',
    'Client ' || COALESCE(v_client_name, 'Unknown') || ' submitted a complaint: ' || COALESCE(NEW.category, 'other'),
    NEW.id,
    now() + interval '30 days'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_complaint();

-- Trigger function: notify when pending sync count exceeds 50
CREATE OR REPLACE FUNCTION public.notify_pending_sync_overflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_count bigint;
  v_recent_notification_exists boolean;
BEGIN
  IF NEW.sync_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.collections
  WHERE sync_status = 'pending';

  IF v_pending_count > 50 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE type = 'pending_sync_overflow'
        AND is_dismissed = false
        AND created_at >= now() - interval '1 hour'
    ) INTO v_recent_notification_exists;

    IF NOT v_recent_notification_exists THEN
      INSERT INTO public.notifications (type, title, body, related_id, expires_at)
      VALUES (
        'pending_sync_overflow',
        'Pending Sync Overflow',
        'There are ' || v_pending_count || ' collections pending sync across all drivers.',
        NULL,
        now() + interval '30 days'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_pending_sync_overflow
  AFTER INSERT OR UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pending_sync_overflow();

-- Cron: clean up expired notifications daily at midnight
SELECT cron.schedule(
  'cleanup-expired-notifications',
  '0 0 * * *',
  $$DELETE FROM public.notifications WHERE expires_at < now()$$
);
