-- Script to clear all data except drivers
-- Run this in Supabase SQL Editor

-- Delete in reverse dependency order
DELETE FROM audit_log;
DELETE FROM notifications;
DELETE FROM sms_log;
DELETE FROM complaints;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM collections;
DELETE FROM route_clients;
DELETE FROM route_drivers;
DELETE FROM routes;
DELETE FROM contracts;
DELETE FROM clients;
DELETE FROM users WHERE role != 'Driver';