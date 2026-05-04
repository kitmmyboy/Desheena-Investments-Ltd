
-- ============================================================
-- ENABLE ROW-LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_drivers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: role check function
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "users_self_read" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- CLIENTS TABLE POLICIES
-- ============================================================
CREATE POLICY "clients_admin_all" ON public.clients
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "clients_ops_manager_all" ON public.clients
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "clients_finance_read" ON public.clients
  FOR SELECT USING (public.get_user_role() = 'Finance');

CREATE POLICY "clients_driver_read" ON public.clients
  FOR SELECT USING (public.get_user_role() = 'Driver');

-- Customer: read own client record (linked via users.client_id)
CREATE POLICY "clients_customer_read_own" ON public.clients
  FOR SELECT USING (
    public.get_user_role() = 'Customer'
    AND id = (SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- ============================================================
-- CONTRACTS TABLE POLICIES
-- ============================================================
CREATE POLICY "contracts_admin_all" ON public.contracts
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "contracts_finance_all" ON public.contracts
  FOR ALL USING (public.get_user_role() = 'Finance');

CREATE POLICY "contracts_ops_manager_all" ON public.contracts
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "contracts_customer_read_own" ON public.contracts
  FOR SELECT USING (
    public.get_user_role() = 'Customer'
    AND client_id = (SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- ============================================================
-- ROUTES TABLE POLICIES
-- ============================================================
CREATE POLICY "routes_admin_all" ON public.routes
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "routes_ops_manager_all" ON public.routes
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "routes_driver_read_assigned" ON public.routes
  FOR SELECT USING (
    public.get_user_role() = 'Driver'
    AND id IN (
      SELECT route_id FROM public.route_drivers WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY "routes_finance_read" ON public.routes
  FOR SELECT USING (public.get_user_role() = 'Finance');

-- ============================================================
-- ROUTE_CLIENTS TABLE POLICIES
-- ============================================================
CREATE POLICY "route_clients_admin_all" ON public.route_clients
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "route_clients_ops_manager_all" ON public.route_clients
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "route_clients_driver_read_assigned" ON public.route_clients
  FOR SELECT USING (
    public.get_user_role() = 'Driver'
    AND route_id IN (
      SELECT route_id FROM public.route_drivers WHERE driver_id = auth.uid()
    )
  );

-- ============================================================
-- ROUTE_DRIVERS TABLE POLICIES
-- ============================================================
CREATE POLICY "route_drivers_admin_all" ON public.route_drivers
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "route_drivers_ops_manager_all" ON public.route_drivers
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "route_drivers_driver_read_own" ON public.route_drivers
  FOR SELECT USING (
    public.get_user_role() = 'Driver'
    AND driver_id = auth.uid()
  );

-- ============================================================
-- COLLECTIONS TABLE POLICIES
-- ============================================================
CREATE POLICY "collections_admin_all" ON public.collections
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "collections_ops_manager_all" ON public.collections
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "collections_driver_own" ON public.collections
  FOR ALL USING (
    public.get_user_role() = 'Driver'
    AND driver_id = auth.uid()
  );

CREATE POLICY "collections_finance_read" ON public.collections
  FOR SELECT USING (public.get_user_role() = 'Finance');

-- ============================================================
-- INVOICES TABLE POLICIES
-- ============================================================
CREATE POLICY "invoices_admin_all" ON public.invoices
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "invoices_finance_all" ON public.invoices
  FOR ALL USING (public.get_user_role() = 'Finance');

CREATE POLICY "invoices_ops_manager_read" ON public.invoices
  FOR SELECT USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "invoices_customer_read_own" ON public.invoices
  FOR SELECT USING (
    public.get_user_role() = 'Customer'
    AND client_id = (SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- ============================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "payments_finance_all" ON public.payments
  FOR ALL USING (public.get_user_role() = 'Finance');

CREATE POLICY "payments_ops_manager_read" ON public.payments
  FOR SELECT USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "payments_customer_read_own" ON public.payments
  FOR SELECT USING (
    public.get_user_role() = 'Customer'
    AND client_id = (SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

-- ============================================================
-- COMPLAINTS TABLE POLICIES
-- ============================================================
CREATE POLICY "complaints_admin_all" ON public.complaints
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "complaints_ops_manager_all" ON public.complaints
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "complaints_customer_own" ON public.complaints
  FOR ALL USING (
    public.get_user_role() = 'Customer'
    AND client_id = (SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "complaints_finance_read" ON public.complaints
  FOR SELECT USING (public.get_user_role() = 'Finance');

-- ============================================================
-- SMS_LOG TABLE POLICIES
-- ============================================================
CREATE POLICY "sms_log_admin_all" ON public.sms_log
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "sms_log_finance_read" ON public.sms_log
  FOR SELECT USING (public.get_user_role() = 'Finance');

CREATE POLICY "sms_log_ops_manager_read" ON public.sms_log
  FOR SELECT USING (public.get_user_role() = 'Operations_Manager');

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================
CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "notifications_ops_manager_all" ON public.notifications
  FOR ALL USING (public.get_user_role() = 'Operations_Manager');

CREATE POLICY "notifications_finance_read" ON public.notifications
  FOR SELECT USING (public.get_user_role() = 'Finance');

-- ============================================================
-- AUDIT_LOG TABLE POLICIES
-- ============================================================
CREATE POLICY "audit_log_admin_all" ON public.audit_log
  FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "audit_log_insert_own" ON public.audit_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit_log_read_own" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());
;
