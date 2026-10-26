-- 0004: quotes, orders, inventory holds, supplier sub-orders, per-recipient payments (sandbox),
-- refunds, ledger, delivery legs, handoffs and ingredient acceptance (Slices 2-4).
-- Fulfilment, funding, settlement and refund states are independent columns/tables (blueprint rule 15).
-- Rollback: 0004_orders_payments_fulfilment.down.sql.

-- Customer delivery addresses reuse private_addresses (owner-scoped, never public).
ALTER TABLE private_addresses ADD COLUMN label text;
ALTER TABLE private_addresses ADD COLUMN kind text NOT NULL DEFAULT 'PARTNER' CHECK (kind IN ('PARTNER','CUSTOMER'));

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES app_users(id),
  offer_id uuid NOT NULL REFERENCES offer_variants(id),
  source text NOT NULL CHECK (source IN ('CHEF','SUPPLIERS')),
  servings integer NOT NULL CHECK (servings > 0),
  slot_id uuid NOT NULL REFERENCES chef_capacity_slots(id),
  address_id uuid NOT NULL REFERENCES private_addresses(id),
  -- Immutable snapshot of every authoritative input (recipe version, price versions, tariffs, lines).
  snapshot jsonb NOT NULL,
  total_piastres bigint NOT NULL CHECK (total_piastres >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ACCEPTED','EXPIRED','SUPERSEDED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX quotes_customer ON quotes (customer_id, created_at DESC);

CREATE FUNCTION guard_quote_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.total_piastres <> OLD.total_piastres
     OR NEW.servings <> OLD.servings OR NEW.source <> OLD.source OR NEW.offer_id <> OLD.offer_id THEN
    RAISE EXCEPTION 'quote snapshots are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_immutable BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION guard_quote_snapshot();

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES app_users(id),
  quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id),
  chef_id uuid NOT NULL REFERENCES chefs(id),
  source text NOT NULL CHECK (source IN ('CHEF','SUPPLIERS')),
  fulfillment_state text NOT NULL DEFAULT 'RESERVED' CHECK (fulfillment_state IN
    ('RESERVED','AWAITING_INGREDIENTS','READY_TO_PREPARE','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','ON_HOLD')),
  funding_state text NOT NULL DEFAULT 'UNFUNDED' CHECK (funding_state IN
    ('UNFUNDED','PARTIALLY_FUNDED','FUNDED','COMPENSATING','COMPENSATED')),
  chef_acceptance text NOT NULL DEFAULT 'PENDING' CHECK (chef_acceptance IN ('PENDING','ACCEPTED','REJECTED')),
  chef_response_deadline timestamptz NOT NULL,
  ingredients_accepted boolean NOT NULL DEFAULT false,
  hold_reason text,
  cancel_reason text,
  total_piastres bigint NOT NULL CHECK (total_piastres >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Preparation never starts unless funded (blueprint rule 12) — enforced in the database too.
  CHECK (fulfillment_state NOT IN ('PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED') OR funding_state = 'FUNDED'),
  CHECK (fulfillment_state NOT IN ('PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED') OR chef_acceptance = 'ACCEPTED'),
  CHECK (source = 'CHEF' OR fulfillment_state NOT IN ('PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED') OR ingredients_accepted)
);
CREATE INDEX orders_customer ON orders (customer_id, created_at DESC);
CREATE INDEX orders_chef ON orders (chef_id, created_at DESC);
ALTER TABLE capacity_reservations ADD CONSTRAINT capacity_reservations_order_fk FOREIGN KEY (order_id) REFERENCES orders(id);

CREATE TABLE order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL,
  actor_user_id uuid REFERENCES app_users(id),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order ON order_events (order_id, id);
CREATE TRIGGER order_events_append_only BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES supplier_products(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  packs integer NOT NULL CHECK (packs > 0),
  state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','CONSUMED','RELEASED','EXPIRED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);
CREATE INDEX inventory_reservations_active_expiry ON inventory_reservations (expires_at) WHERE state = 'ACTIVE';

CREATE TABLE supplier_suborders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  branch_id uuid NOT NULL REFERENCES supplier_branches(id),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','CONFIRMED','REJECTED','HANDED_OVER','CANCELLED')),
  lines jsonb NOT NULL,
  total_piastres bigint NOT NULL CHECK (total_piastres >= 0),
  reject_reason text,
  response_deadline timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, branch_id),
  CHECK (state <> 'REJECTED' OR reject_reason IS NOT NULL)
);
CREATE INDEX supplier_suborders_branch ON supplier_suborders (branch_id, created_at DESC);

-- Recipient-specific allocations (blueprint baseline: customer pays identified recipients).
CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  recipient_type text NOT NULL CHECK (recipient_type IN ('CHEF','SUPPLIER','DELIVERY_LEG','PLATFORM')),
  recipient_id uuid NOT NULL,
  components text[] NOT NULL,
  amount_piastres bigint NOT NULL CHECK (amount_piastres > 0),
  UNIQUE (order_id, recipient_type, recipient_id)
);

CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES payment_allocations(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL,
  provider_ref text NOT NULL UNIQUE,
  amount_piastres bigint NOT NULL CHECK (amount_piastres > 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','SUCCEEDED','FAILED','UNKNOWN','VOIDED')),
  refunded_piastres bigint NOT NULL DEFAULT 0 CHECK (refunded_piastres >= 0),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (refunded_piastres <= amount_piastres)
);
-- Never two live attempts for the same allocation (blocks blind duplicate charges).
CREATE UNIQUE INDEX payment_attempts_one_live ON payment_attempts (allocation_id) WHERE state IN ('PENDING','UNKNOWN','SUCCEEDED');

-- Every inbound provider event is stored once (provider + event id unique) before processing.
CREATE TABLE provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  outcome text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES payment_attempts(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  amount_piastres bigint NOT NULL CHECK (amount_piastres > 0),
  reason text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','CONFIRMED','FAILED')),
  provider_ref text NOT NULL UNIQUE,
  requested_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Double-entry ledger of what each recipient is owed / was refunded. Not a customer wallet.
CREATE TABLE ledger_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  txn_id uuid NOT NULL,
  account text NOT NULL,
  debit_piastres bigint NOT NULL DEFAULT 0 CHECK (debit_piastres >= 0),
  credit_piastres bigint NOT NULL DEFAULT 0 CHECK (credit_piastres >= 0),
  order_id uuid REFERENCES orders(id),
  attempt_id uuid REFERENCES payment_attempts(id),
  refund_id uuid REFERENCES refunds(id),
  memo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit_piastres = 0) <> (credit_piastres = 0))
);
CREATE INDEX ledger_entries_txn ON ledger_entries (txn_id);
CREATE INDEX ledger_entries_account ON ledger_entries (account);
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
-- Every transaction must balance; checked at commit.
CREATE FUNCTION check_ledger_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d bigint; c bigint;
BEGIN
  SELECT coalesce(sum(debit_piastres),0), coalesce(sum(credit_piastres),0) INTO d, c FROM ledger_entries WHERE txn_id = NEW.txn_id;
  IF d <> c THEN RAISE EXCEPTION 'ledger transaction % is unbalanced (% vs %)', NEW.txn_id, d, c USING ERRCODE = 'check_violation'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_ledger_balanced();

CREATE TABLE delivery_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL CHECK (kind IN ('INGREDIENT_TO_CHEF','MEAL_TO_CUSTOMER')),
  fee_piastres bigint NOT NULL CHECK (fee_piastres >= 0),
  tariff_id uuid REFERENCES delivery_tariffs(id),
  state text NOT NULL DEFAULT 'OPEN' CHECK (state IN ('WAITING','OPEN','ASSIGNED','PICKED_UP','DELIVERED','CANCELLED')),
  courier_id uuid REFERENCES courier_profiles(id),
  assigned_at timestamptz,
  required_equipment text[] NOT NULL DEFAULT '{}',
  from_area_id uuid NOT NULL REFERENCES service_areas(id),
  to_area_id uuid NOT NULL REFERENCES service_areas(id),
  destination_address_id uuid NOT NULL REFERENCES private_addresses(id),
  dropoff_code_hash text NOT NULL,
  dropoff_attempts integer NOT NULL DEFAULT 0 CHECK (dropoff_attempts >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, kind),
  CHECK ((state IN ('ASSIGNED','PICKED_UP','DELIVERED')) = (courier_id IS NOT NULL) OR state = 'CANCELLED')
);
CREATE INDEX delivery_legs_open ON delivery_legs (state, from_area_id) WHERE state = 'OPEN';

CREATE TABLE delivery_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id uuid NOT NULL REFERENCES delivery_legs(id),
  seq integer NOT NULL CHECK (seq > 0),
  party_type text NOT NULL CHECK (party_type IN ('SUPPLIER_BRANCH','CHEF')),
  party_id uuid NOT NULL,
  pickup_address_id uuid REFERENCES private_addresses(id),
  bag_count integer CHECK (bag_count > 0),
  pickup_code_hash text NOT NULL,
  pickup_attempts integer NOT NULL DEFAULT 0 CHECK (pickup_attempts >= 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','COLLECTED')),
  collected_at timestamptz,
  UNIQUE (leg_id, seq),
  CHECK ((state = 'COLLECTED') = (collected_at IS NOT NULL))
);

-- Courier delivery to the chef is NOT chef acceptance (blueprint rule 12): recorded separately.
CREATE TABLE ingredient_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  chef_user_id uuid NOT NULL REFERENCES app_users(id),
  accepted boolean NOT NULL,
  lines jsonb NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (accepted OR note IS NOT NULL)
);
