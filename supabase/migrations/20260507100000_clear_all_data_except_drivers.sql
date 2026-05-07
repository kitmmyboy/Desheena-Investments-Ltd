-- Delete all data except drivers (users with role 'Driver')
-- Execute in order due to foreign key constraints

-- Delete audit_log
DELETE FROM audit_log;

-- Delete notifications
DELETE FROM notifications;

-- Delete sms_log
DELETE FROM sms_log;

-- Delete complaints
DELETE FROM complaints;

-- Delete payments
DELETE FROM payments;

-- Delete invoices
DELETE FROM invoices;

-- Delete collections
DELETE FROM collections;

-- Delete route_clients
DELETE FROM route_clients;

-- Delete route_drivers
DELETE FROM route_drivers;

-- Delete routes
DELETE FROM routes;

-- Delete contracts
DELETE FROM contracts;

-- Delete clients
DELETE FROM clients;

-- Keep only drivers in users table
DELETE FROM users WHERE role != 'Driver';