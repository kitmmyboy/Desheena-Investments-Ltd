-- Add resolution fields to complaints table
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS resolver_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_complaints_resolver_id ON public.complaints USING btree (resolver_id);
