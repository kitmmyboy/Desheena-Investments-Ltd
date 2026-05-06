
-- Create fcm_tokens table
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  device_type TEXT, -- 'ios', 'android', 'web'
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, token)
);

-- RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can manage their own tokens" ON public.fcm_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Admins can view all tokens
CREATE POLICY "Admins can view all tokens" ON public.fcm_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('Admin', 'Operations_Manager')
    )
  );

-- Function to clean up old tokens?
-- Optional: We could add a trigger to update last_seen.
