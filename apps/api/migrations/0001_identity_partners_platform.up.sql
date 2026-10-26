-- 0001: identity, scoped roles, partner applications, private evidence, audit, outbox, idempotency.
-- Stories: H01, S01, D01, O01, C01 (areas). Reviewed rollback: 0001_*.down.sql.
-- IDs are server-generated (gen_random_uuid, built into PostgreSQL 13+).

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_subject text NOT NULL UNIQUE CHECK (length(identity_subject) BETWEEN 1 AND 255),
  display_name text CHECK (display_name IS NULL OR length(display_name) <= 80),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETION_REQUESTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Manually selectable service areas. Physical ordering is enabled per area by operations.
CREATE TABLE service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,64}$'),
  label_en text NOT NULL,
  label_ar text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'COMING_SOON', 'INACTIVE')),
  physical_ordering_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  CHECK (NOT physical_ordering_enabled OR status = 'ACTIVE')
);

-- PRIVATE. Exact addresses are never part of any public projection.
CREATE TABLE private_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  address_text text NOT NULL CHECK (length(address_text) BETWEEN 5 AND 500),
  area_id uuid NOT NULL REFERENCES service_areas(id),
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  access_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  role text NOT NULL CHECK (role IN ('CUSTOMER','CHEF_OWNER','CHEF_STAFF','SUPPLIER_OWNER','SUPPLIER_STAFF','COURIER','OPS_VERIFIER','OPS_ADMIN')),
  scope_type text NOT NULL CHECK (scope_type IN ('GLOBAL','CHEF','SUPPLIER_ORG','SUPPLIER_BRANCH','COURIER')),
  scope_id uuid,
  approval_state text NOT NULL CHECK (approval_state IN ('PENDING','APPROVED','REJECTED','SUSPENDED','REVOKED')),
  granted_by uuid REFERENCES app_users(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'GLOBAL') = (scope_id IS NULL)),
  CHECK (
    (role IN ('CUSTOMER','OPS_VERIFIER','OPS_ADMIN') AND scope_type = 'GLOBAL') OR
    (role IN ('CHEF_OWNER','CHEF_STAFF') AND scope_type = 'CHEF') OR
    (role = 'SUPPLIER_OWNER' AND scope_type = 'SUPPLIER_ORG') OR
    (role = 'SUPPLIER_STAFF' AND scope_type = 'SUPPLIER_BRANCH') OR
    (role = 'COURIER' AND scope_type = 'COURIER')
  ),
  -- Nobody grants their own membership.
  CHECK (granted_by IS NULL OR granted_by <> user_id)
);
CREATE UNIQUE INDEX role_memberships_unique_scope
  ON role_memberships (user_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX role_memberships_scope ON role_memberships (scope_type, scope_id);

CREATE TABLE chefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES app_users(id),
  public_name text NOT NULL CHECK (length(public_name) BETWEEN 2 AND 80),
  public_bio_en text NOT NULL DEFAULT '',
  public_bio_ar text NOT NULL DEFAULT '',
  public_area_id uuid NOT NULL REFERENCES service_areas(id),
  kitchen_address_id uuid REFERENCES private_addresses(id), -- PRIVATE
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  accepting_orders boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  is_illustrative boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT accepting_orders OR status = 'APPROVED')
);

CREATE TABLE chef_service_areas (
  chef_id uuid NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES service_areas(id),
  PRIMARY KEY (chef_id, area_id)
);
CREATE INDEX chef_service_areas_area ON chef_service_areas (area_id);

CREATE TABLE supplier_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_users(id),
  public_name text NOT NULL CHECK (length(public_name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  is_illustrative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES supplier_organizations(id),
  public_name text NOT NULL CHECK (length(public_name) BETWEEN 2 AND 120),
  area_id uuid NOT NULL REFERENCES service_areas(id),
  address_id uuid REFERENCES private_addresses(id), -- PRIVATE
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  is_open boolean NOT NULL DEFAULT false,
  is_illustrative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  CHECK (NOT is_open OR status = 'APPROVED')
);

CREATE TABLE supplier_branch_service_areas (
  branch_id uuid NOT NULL REFERENCES supplier_branches(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES service_areas(id),
  PRIMARY KEY (branch_id, area_id)
);
CREATE INDEX supplier_branch_service_areas_area ON supplier_branch_service_areas (area_id);

CREATE TABLE courier_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 80),
  equipment text[] NOT NULL CHECK (
    cardinality(equipment) >= 1 AND
    equipment <@ ARRAY['INSULATED_BAG','COLD_BOX','BICYCLE','MOTORCYCLE','CAR']::text[]
  ),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
  availability text NOT NULL DEFAULT 'OFFLINE' CHECK (availability IN ('OFFLINE','AVAILABLE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (availability = 'OFFLINE' OR status = 'APPROVED')
);

CREATE TABLE partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid NOT NULL REFERENCES app_users(id),
  kind text NOT NULL CHECK (kind IN ('CHEF','SUPPLIER','COURIER')),
  subject_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','WITHDRAWN')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES app_users(id),
  decision_reason text,
  permitted_next_step text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  -- O01 separation of duties enforced in the database as well as the API.
  CHECK (decided_by IS NULL OR decided_by <> applicant_user_id),
  CHECK ((status IN ('APPROVED','REJECTED')) = (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)),
  CHECK (status <> 'REJECTED' OR permitted_next_step IS NOT NULL)
);
CREATE UNIQUE INDEX partner_applications_one_open
  ON partner_applications (applicant_user_id, kind) WHERE status = 'SUBMITTED';
CREATE INDEX partner_applications_queue ON partner_applications (status, submitted_at);

-- PRIVATE evidence references. Files live in private object storage (adapter not yet connected).
CREATE TABLE partner_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES partner_applications(id),
  evidence_type text NOT NULL CHECK (evidence_type IN ('NATIONAL_ID','KITCHEN_PHOTO','FOOD_HANDLER_CERTIFICATE','COMMERCIAL_REGISTRATION','TAX_CARD','DRIVING_LICENSE','VEHICLE_LICENSE','OTHER')),
  object_key text NOT NULL UNIQUE,
  storage_state text NOT NULL CHECK (storage_state IN ('STORAGE_DISABLED','DEV_METADATA_ONLY','UPLOADED')),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  expires_on date,
  review_state text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (review_state IN ('PENDING_REVIEW','ACCEPTED','REJECTED')),
  uploaded_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_evidence_application ON partner_evidence (application_id);
CREATE INDEX partner_evidence_expiry ON partner_evidence (expires_on) WHERE expires_on IS NOT NULL;

-- Append-only audit trail. Never store secrets, raw evidence or full addresses in metadata.
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_target ON audit_events (target_type, target_id, occurred_at);

CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Transactional outbox: written in the same transaction as the state change.
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  payload jsonb NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSED','DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  outcome text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'PROCESSED') = (processed_at IS NOT NULL))
);
CREATE INDEX outbox_due ON outbox_events (next_attempt_at) WHERE status = 'PENDING';

CREATE TABLE idempotency_records (
  actor_user_id uuid NOT NULL REFERENCES app_users(id),
  route text NOT NULL,
  key text NOT NULL CHECK (length(key) BETWEEN 8 AND 128),
  request_hash text NOT NULL,
  status_code integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (actor_user_id, route, key)
);
CREATE INDEX idempotency_expiry ON idempotency_records (expires_at);
