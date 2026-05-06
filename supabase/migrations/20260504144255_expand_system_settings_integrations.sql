-- Expand system_settings with integration, billing, alert, sync, security, and company keys
INSERT INTO public.system_settings (key, value, label, description) VALUES
  -- Company
  ('company_name',    'Desheena Investments Ltd', 'Company Name',    'Displayed on invoices and SMS messages'),
  ('company_address', '',                          'Company Address', 'Physical address of the company'),
  ('company_phone',   '',                          'Company Phone',   'Support phone number shown to clients'),
  ('company_email',   '',                          'Company Email',   'Support email shown to clients'),
  ('company_tin',     '',                          'TIN / Tax ID',    'Tax Identification Number'),

  -- App general
  ('app_title',        'Desheena Admin',   'App Title',    'Browser tab title and dashboard header name'),
  ('app_timezone',     'Africa/Kampala',   'Timezone',     'System timezone for scheduled jobs and display'),
  ('app_language',     'en',               'Language',     'Interface language: en (English), sw (Swahili)'),
  ('app_currency',     'UGX',              'Currency',     'Currency code used across invoices and reports'),
  ('app_primary_color','#16a34a',          'Primary Color','Hex color used for active nav items and buttons'),
  ('app_logo_url',     '',                 'Logo URL',     'URL to your company logo (PNG/SVG, shown in sidebar)'),
  ('app_favicon_url',  '',                 'Favicon URL',  'URL to your site favicon (ICO/PNG, 32×32 recommended)'),

  -- Billing / invoices
  ('invoice_auto_generate',          'true',                                    'Auto-generate Invoices',        'Automatically generate invoices on the 1st of each month'),
  ('invoice_due_days',               '14',                                      'Invoice Due Days',              'Number of days after generation before an invoice is overdue'),
  ('vat_rate',                       '18',                                      'VAT Rate (%)',                  'VAT percentage applied to invoices (0 to disable)'),
  ('late_payment_fee_pct',           '0',                                       'Late Payment Fee (%)',          'Percentage added to overdue invoices'),
  ('grace_period_days',              '3',                                       'Grace Period (days)',           'Days after due date before late fee applies'),
  ('invoice_show_vat',               'true',                                    'Show VAT on Invoice',           'Display VAT line on invoice documents'),
  ('invoice_show_payment_instructions','true',                                  'Show Payment Instructions',     'Display payment instructions on invoices'),
  ('invoice_number_prefix',          'INV-',                                    'Invoice Number Prefix',         'Prefix for invoice numbers'),
  ('invoice_next_number',            '1001',                                    'Next Invoice Number',           'The next invoice number to use'),
  ('invoice_footer',                 'Thank you for your business.',            'Invoice Footer',                'Text shown at the bottom of invoices'),
  ('invoice_template_header',        'Desheena Investments Ltd',               'Invoice Template Header',       'Header text for invoice documents'),
  ('invoice_template_footer',        'Thank you for your business. For queries contact us at info@desheena.co.ug', 'Invoice Template Footer', 'Footer text for invoice documents'),
  ('payment_terms',                  'Payment is due within 7days of invoice date.', 'Payment Terms',           'Payment terms text shown on invoices'),

  -- Africa''s Talking SMS
  ('at_username',   'sandbox',  'Africa''s Talking Username', 'Your Africa''s Talking username (use "sandbox" for testing)'),
  ('at_api_key',    '',         'Africa''s Talking API Key',  'Your Africa''s Talking API key'),
  ('at_shortcode',  '',         'Shortcode / Sender ID',      'Registered shortcode or alphanumeric sender ID (max 11 chars)'),
  ('at_environment','sandbox',  'Environment',                'sandbox or production'),
  ('sms_sender_id', 'Desheena', 'SMS Sender ID',              'Africa''s Talking sender ID (max 11 chars)'),
  ('sms_template_invoice',   'Hello {{client_name}}, your invoice of {{amount}} UGX is due on {{due_date}}. Ref: {{invoice_ref}}. - Desheena',   'SMS: Invoice Generated',  'SMS template for new invoice notification'),
  ('sms_template_payment',   'Dear {{client_name}}, payment of {{amount}} UGX received for invoice {{invoice_ref}}. Thank you. - Desheena',      'SMS: Payment Confirmed',  'SMS template for payment confirmation'),
  ('sms_template_complaint', 'Dear {{client_name}}, your complaint (ref: {{complaint_ref}}) status: {{status}}. - Desheena',                     'SMS: Complaint Update',   'SMS template for complaint status updates'),

  -- Pesapal
  ('pesapal_environment',     'sandbox', 'Pesapal Environment',     'sandbox or production'),
  ('pesapal_consumer_key',    '',        'Pesapal Consumer Key',     'From your Pesapal merchant dashboard'),
  ('pesapal_consumer_secret', '',        'Pesapal Consumer Secret',  'From your Pesapal merchant dashboard'),
  ('pesapal_currency',        'UGX',     'Pesapal Currency',         'Currency for Pesapal transactions (UGX)'),
  ('pesapal_callback_url',    '',        'Pesapal Callback URL',     'URL Pesapal redirects the customer to after payment'),
  ('pesapal_ipn_url',         '',        'Pesapal IPN URL',          'Your webhook URL that Pesapal posts payment notifications to'),

  -- SMTP
  ('smtp_host',       '',                        'SMTP Host',       'e.g. smtp.gmail.com or smtp.sendgrid.net'),
  ('smtp_port',       '587',                     'SMTP Port',       '587 (TLS) or 465 (SSL)'),
  ('smtp_user',       '',                        'SMTP Username',   'SMTP login username or email address'),
  ('smtp_password',   '',                        'SMTP Password',   'SMTP password or app-specific password (stored encrypted)'),
  ('smtp_from_email', '',                        'From Email',      'Sender email address for outgoing emails'),
  ('smtp_from_name',  'Desheena Investments Ltd','From Name',       'Sender name shown in outgoing emails'),
  ('smtp_encryption', 'tls',                     'Encryption',      'tls or ssl'),

  -- Alerts
  ('alert_new_complaint_enabled',  'true',  'New Complaint Alert Enabled',  'Enable alert for new complaints'),
  ('alert_missed_route_enabled',   'true',  'Missed Route Alert Enabled',   'Enable alert for missed routes'),
  ('alert_missed_route_time',      '18:00', 'Missed Route Check Time',      'Time to check for missed routes'),
  ('alert_pending_sync_enabled',   'true',  'Pending Sync Alert Enabled',   'Enable alert when pending sync exceeds threshold'),
  ('alert_pending_sync_threshold', '50',    'Pending Sync Threshold',       'Number of pending records to trigger alert'),
  ('alert_overdue_sms_enabled',    'true',  'Overdue Invoice SMS Enabled',  'Send SMS when invoice becomes overdue'),
  ('missed_route_check_time',      '14:00', 'Missed Route Check Time',      'Local time (HH:MM) to check for drivers with no collections'),

  -- Sync
  ('sync_retry_interval',         '5',  'Sync Retry Interval (minutes)', 'How often the sync engine retries failed uploads'),
  ('sync_max_retries',            '3',  'Max Sync Retries',              'Maximum retry attempts per record before marking as failed'),
  ('sync_queue_warning_threshold','50', 'Queue Size Warning Threshold',  'Alert when pending sync records exceed this count'),
  ('conflict_resolution_strategy','server_wins', 'Conflict Resolution Strategy', 'How sync conflicts are resolved'),
  ('pending_sync_threshold',      '50', 'Pending Sync Alert Threshold',  'Trigger an alert when pending sync records exceed this count'),

  -- Security
  ('max_login_attempts',      '5',    'Max Login Attempts',       'Lockout after this many failed attempts'),
  ('session_timeout_minutes', '60',   'Session Timeout (minutes)','Idle session timeout'),
  ('password_min_length',     '8',    'Minimum Password Length',  'Minimum characters required for passwords'),
  ('password_require_uppercase','true','Require Uppercase',       'Password must contain at least one uppercase letter'),
  ('password_require_number', 'true', 'Require Number',           'Password must contain at least one number'),

  -- Backup
  ('backup_history', '[]', 'Backup History', 'JSON array of backup records'),

  -- Role permissions (default JSON)
  ('role_permissions', '{}', 'Role Permissions', 'JSON object defining per-role permissions')

ON CONFLICT (key) DO NOTHING;
