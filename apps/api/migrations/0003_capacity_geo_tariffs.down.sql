-- Rollback of 0003. DESTRUCTIVE for capacity and tariff data.
DROP TABLE IF EXISTS delivery_tariffs;
DROP TABLE IF EXISTS capacity_reservations;
DROP TABLE IF EXISTS chef_capacity_slots;
ALTER TABLE offer_variants DROP COLUMN IF EXISTS work_units_per_serving;
ALTER TABLE offer_variants DROP COLUMN IF EXISTS base_work_units;
ALTER TABLE service_areas DROP COLUMN IF EXISTS longitude;
ALTER TABLE service_areas DROP COLUMN IF EXISTS latitude;
DROP EXTENSION IF EXISTS btree_gist;
