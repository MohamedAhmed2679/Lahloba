-- 0003: kitchen capacity (H04), area coordinates for maps/distance estimates, delivery tariffs.
-- Rollback: 0003_capacity_geo_tariffs.down.sql.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Approximate public centroid of each area (district level). Never a private address.
ALTER TABLE service_areas ADD COLUMN latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE service_areas ADD COLUMN longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180);

-- Work units: the chef's effort for a variant = base + per_serving x servings.
ALTER TABLE offer_variants ADD COLUMN base_work_units integer NOT NULL DEFAULT 0 CHECK (base_work_units >= 0);
ALTER TABLE offer_variants ADD COLUMN work_units_per_serving integer NOT NULL DEFAULT 1 CHECK (work_units_per_serving >= 1);

-- Capacity is expressed in work units per time slot, not order count (H04).
CREATE TABLE chef_capacity_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id uuid NOT NULL REFERENCES chefs(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  total_work_units integer NOT NULL CHECK (total_work_units > 0 AND total_work_units <= 10000),
  reserved_work_units integer NOT NULL DEFAULT 0 CHECK (reserved_work_units >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CANCELLED')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '12 hours'),
  CHECK (reserved_work_units <= total_work_units),
  CHECK (status = 'ACTIVE' OR reserved_work_units = 0),
  -- A chef cannot have two overlapping active slots (prevents double-counted capacity).
  EXCLUDE USING gist (chef_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'ACTIVE')
);
CREATE INDEX chef_capacity_slots_upcoming ON chef_capacity_slots (chef_id, starts_at) WHERE status = 'ACTIVE';

-- Holds against a slot. ACTIVE holds expire; CONSUMED when preparation starts; RELEASED on cancel.
CREATE TABLE capacity_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES chef_capacity_slots(id),
  order_id uuid,
  work_units integer NOT NULL CHECK (work_units > 0),
  state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','CONFIRMED','CONSUMED','RELEASED','EXPIRED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'ACTIVE' OR expires_at IS NOT NULL)
);
CREATE INDEX capacity_reservations_active_expiry ON capacity_reservations (expires_at) WHERE state = 'ACTIVE';
CREATE UNIQUE INDEX capacity_reservations_one_live_per_order ON capacity_reservations (order_id) WHERE order_id IS NOT NULL AND state IN ('ACTIVE','CONFIRMED');

-- Delivery tariffs between public areas. The founder's 20-75 EGP final-trip range and the 20 EGP
-- consolidated ingredient trip are enforced in code; the area-pair table is CONFIGURABLE business
-- data (distance bands are an open decision) and seeded with clearly illustrative values.
CREATE TABLE delivery_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('FINAL','INGREDIENT')),
  from_area_id uuid NOT NULL REFERENCES service_areas(id),
  to_area_id uuid NOT NULL REFERENCES service_areas(id),
  fee_piastres bigint NOT NULL CHECK (fee_piastres >= 0),
  eligible boolean NOT NULL DEFAULT true,
  max_stops integer NOT NULL DEFAULT 1 CHECK (max_stops BETWEEN 1 AND 10),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_illustrative boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, from_area_id, to_area_id),
  CHECK (kind <> 'FINAL' OR NOT eligible OR fee_piastres BETWEEN 2000 AND 7500),
  CHECK (kind <> 'INGREDIENT' OR NOT eligible OR fee_piastres = 2000)
);
