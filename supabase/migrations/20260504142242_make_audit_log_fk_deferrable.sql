-- Make audit_log foreign key to users deferrable to avoid ordering issues
-- during bulk inserts / auth trigger ordering
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;
