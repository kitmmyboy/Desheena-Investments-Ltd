
-- Add client_id to users table so Customer users can be linked to their client record
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);
;
