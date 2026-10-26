-- Rollback of 0001. DESTRUCTIVE: drops identity, partner and audit data.
-- Only for disposable/dev databases or a reviewed recovery plan with a verified backup.
DROP TABLE IF EXISTS idempotency_records;
DROP TABLE IF EXISTS outbox_events;
DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
DROP TABLE IF EXISTS audit_events;
DROP FUNCTION IF EXISTS forbid_mutation();
DROP TABLE IF EXISTS partner_evidence;
DROP TABLE IF EXISTS partner_applications;
DROP TABLE IF EXISTS courier_profiles;
DROP TABLE IF EXISTS supplier_branch_service_areas;
DROP TABLE IF EXISTS supplier_branches;
DROP TABLE IF EXISTS supplier_organizations;
DROP TABLE IF EXISTS chef_service_areas;
DROP TABLE IF EXISTS chefs;
DROP TABLE IF EXISTS role_memberships;
DROP TABLE IF EXISTS private_addresses;
DROP TABLE IF EXISTS service_areas;
DROP TABLE IF EXISTS app_users;
