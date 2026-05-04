
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE (mirrors auth.users, stores role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('Admin', 'Operations_Manager', 'Driver', 'Finance', 'Customer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  location_text     TEXT,
  gps_lat           DOUBLE PRECISION,
  gps_lng           DOUBLE PRECISION,
  zone              TEXT,
  service_frequency INTEGER,           -- collections per week
  monthly_rate      NUMERIC(12, 2),    -- UGX
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONTRACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date          DATE NOT NULL,
  billing_cycle       TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly')),
  billing_model       TEXT NOT NULL DEFAULT 'flat' CHECK (billing_model IN ('flat', 'frequency')),
  monthly_rate        NUMERIC(12, 2),   -- UGX (used for flat billing)
  per_collection_rate NUMERIC(12, 2),   -- UGX (used for frequency billing)
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  end_date            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROUTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  zone        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROUTE_CLIENTS TABLE (many-to-many: routes <-> clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.route_clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sequence_order INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, client_id)
);

-- ============================================================
-- ROUTE_DRIVERS TABLE (many-to-many: routes <-> drivers/users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.route_drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, driver_id)
);

-- ============================================================
-- COLLECTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  driver_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  route_id     UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  waste_type   TEXT NOT NULL CHECK (waste_type IN ('general', 'organic', 'recyclable', 'hazardous')),
  weight_kg    NUMERIC(8, 2),
  gps_lat      DOUBLE PRECISION,
  gps_lng      DOUBLE PRECISION,
  missing_gps  BOOLEAN NOT NULL DEFAULT FALSE,
  sync_status  TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced')),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  contract_id    UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  amount         NUMERIC(12, 2) NOT NULL,
  vat_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(12, 2) NOT NULL,
  due_date       DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  amount          NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'UGX',
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('pesapal', 'manual', 'bank_transfer', 'mobile_money')),
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  paid_at         TIMESTAMPTZ,
  pesapal_error   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMPLAINTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  submitted_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message          TEXT NOT NULL CHECK (char_length(message) <= 1000),
  category         TEXT NOT NULL CHECK (category IN ('missed_collection', 'billing_dispute', 'service_quality', 'other')),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolver_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SMS_LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sms_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone     TEXT NOT NULL,
  message_content     TEXT NOT NULL,
  message_type        TEXT,   -- e.g. 'invoice_generated', 'payment_confirmed', 'overdue_reminder', 'complaint_update'
  related_id          UUID,   -- optional reference to invoice/complaint/payment UUID
  africas_talking_id  TEXT,
  delivery_status     TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  error_code          TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,   -- e.g. 'missed_collection', 'pending_sync_high', 'new_complaint'
  title        TEXT NOT NULL,
  body         TEXT,
  related_id   UUID,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- ============================================================
-- AUDIT_LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- e.g. 'login', 'logout', 'failed_login', 'record_updated'
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_collections_client_id    ON public.collections(client_id);
CREATE INDEX IF NOT EXISTS idx_collections_driver_id    ON public.collections(driver_id);
CREATE INDEX IF NOT EXISTS idx_collections_route_id     ON public.collections(route_id);
CREATE INDEX IF NOT EXISTS idx_collections_sync_status  ON public.collections(sync_status);
CREATE INDEX IF NOT EXISTS idx_collections_collected_at ON public.collections(collected_at);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id       ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status          ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date        ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id      ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id       ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_complaints_client_id     ON public.complaints(client_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status        ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_route_clients_route_id   ON public.route_clients(route_id);
CREATE INDEX IF NOT EXISTS idx_route_clients_client_id  ON public.route_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_route_drivers_route_id   ON public.route_drivers(route_id);
CREATE INDEX IF NOT EXISTS idx_route_drivers_driver_id  ON public.route_drivers(driver_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_recipient        ON public.sms_log(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id        ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type     ON public.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_clients_zone             ON public.clients(zone);
CREATE INDEX IF NOT EXISTS idx_clients_is_active        ON public.clients(is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id      ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status         ON public.contracts(status);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'clients', 'contracts', 'routes', 'route_clients', 'route_drivers',
    'collections', 'invoices', 'payments', 'complaints', 'sms_log',
    'notifications', 'audit_log'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON public.%s
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
;
