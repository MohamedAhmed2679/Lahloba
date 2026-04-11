-- Lahloba v1.0 — All money in minor units (piasters)
CREATE TYPE role_type AS ENUM ('CUSTOMER','CHEF','STORE','DELIVERY','ADMIN');
CREATE TYPE order_status AS ENUM ('CREATED','CONFIRMED','INGREDIENTS_SOURCING','INGREDIENTS_DELIVERED_TO_CHEF','CHEF_PREPARING','MEAL_READY','MEAL_ON_THE_WAY','DELIVERED','CANCELLED');
CREATE TYPE ingredient_source AS ENUM ('CHEF','STORES');
CREATE TYPE combo_mode AS ENUM ('CHEAPEST','FASTEST');
CREATE TYPE delivery_task_type AS ENUM ('INGREDIENT_RUN','MEAL_RUN');
CREATE TYPE delivery_task_status AS ENUM ('AVAILABLE','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING','SUCCEEDED','FAILED');
CREATE TYPE refund_type AS ENUM ('PARTIAL','FULL');
CREATE TYPE chat_message_type AS ENUM ('TEXT','IMAGE','SYSTEM');
CREATE TYPE ticket_status AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');

CREATE TABLE users (user_id TEXT PRIMARY KEY, role role_type NOT NULL, phone TEXT UNIQUE, email TEXT UNIQUE, name TEXT, avatar_url TEXT, locale TEXT DEFAULT 'en', rating_avg NUMERIC(3,2) DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, push_token TEXT, device_platform TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE addresses (address_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, label TEXT DEFAULT 'Home', line1 TEXT NOT NULL, line2 TEXT, city TEXT NOT NULL, region TEXT NOT NULL, lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, notes TEXT, is_default BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_addr_user ON addresses(user_id);

CREATE TABLE chef_profiles (chef_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE, bio TEXT, hygiene_score NUMERIC(3,2) DEFAULT 0, max_concurrent INTEGER DEFAULT 3, is_available BOOLEAN DEFAULT TRUE, zone_id TEXT);

CREATE TABLE ingredients (ingredient_id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, unit TEXT NOT NULL, category TEXT, image_url TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE meals (meal_id TEXT PRIMARY KEY, chef_id TEXT NOT NULL REFERENCES chef_profiles(chef_id), name_en TEXT NOT NULL, name_ar TEXT NOT NULL, description_en TEXT, description_ar TEXT, type TEXT CHECK (type IN ('COOKED','READY_TO_COOK')) NOT NULL, base_price_minor BIGINT NOT NULL, prep_time_min INTEGER DEFAULT 30, allergens TEXT[] DEFAULT '{}', image_url TEXT, is_active BOOLEAN DEFAULT TRUE, rating_avg NUMERIC(3,2) DEFAULT 0, order_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_meals_chef ON meals(chef_id);

CREATE TABLE meal_ingredients (meal_id TEXT REFERENCES meals(meal_id) ON DELETE CASCADE, ingredient_id TEXT REFERENCES ingredients(ingredient_id), qty NUMERIC(10,3) NOT NULL, unit TEXT NOT NULL, is_optional BOOLEAN DEFAULT FALSE, PRIMARY KEY (meal_id, ingredient_id));

CREATE TABLE store_profiles (store_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, address_id TEXT, zone_id TEXT, acceptance_rate NUMERIC(5,2) DEFAULT 100, avg_pack_min INTEGER DEFAULT 15);

CREATE TABLE store_products (product_id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES store_profiles(store_id) ON DELETE CASCADE, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, price_minor BIGINT NOT NULL, unit TEXT NOT NULL, in_stock BOOLEAN DEFAULT TRUE, image_url TEXT, updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE product_ingredient_map (product_id TEXT REFERENCES store_products(product_id) ON DELETE CASCADE, ingredient_id TEXT REFERENCES ingredients(ingredient_id) ON DELETE CASCADE, unit_factor NUMERIC(10,3) DEFAULT 1, PRIMARY KEY (product_id, ingredient_id));

CREATE TABLE orders (order_id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(user_id), chef_id TEXT NOT NULL REFERENCES users(user_id), meal_id TEXT NOT NULL REFERENCES meals(meal_id), servings INTEGER NOT NULL CHECK (servings>=1), ingredient_source ingredient_source NOT NULL, ingredient_combo_mode combo_mode, combo_id TEXT, scheduled_at TIMESTAMPTZ NOT NULL, address_id TEXT NOT NULL REFERENCES addresses(address_id), notes_to_chef TEXT, pricing JSONB NOT NULL, status order_status NOT NULL DEFAULT 'CREATED', order_version INTEGER NOT NULL DEFAULT 1, idempotency_key TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pricing ON orders USING GIN(pricing);

CREATE TABLE store_fulfillments (store_fulfillment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, store_id TEXT NOT NULL REFERENCES store_profiles(store_id), status TEXT NOT NULL DEFAULT 'PACKING', subtotal_minor BIGINT NOT NULL, pickup_window_start TIMESTAMPTZ, pickup_window_end TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE store_fulfillment_lines (line_id TEXT PRIMARY KEY, store_fulfillment_id TEXT NOT NULL REFERENCES store_fulfillments(store_fulfillment_id) ON DELETE CASCADE, ingredient_id TEXT, product_id TEXT, qty NUMERIC(10,3) NOT NULL, unit TEXT NOT NULL, line_total_minor BIGINT NOT NULL, substitution_status TEXT NOT NULL DEFAULT 'NONE');

CREATE TABLE substitutions (substitution_id TEXT PRIMARY KEY, store_fulfillment_id TEXT NOT NULL REFERENCES store_fulfillments(store_fulfillment_id) ON DELETE CASCADE, line_id TEXT NOT NULL, original JSONB NOT NULL, proposed JSONB NOT NULL, price_diff_minor BIGINT DEFAULT 0, customer_approval TEXT DEFAULT 'PENDING', chef_approval TEXT DEFAULT 'PENDING', final_status TEXT, finalized_at TIMESTAMPTZ);

CREATE TABLE delivery_tasks (task_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, task_type delivery_task_type NOT NULL, status delivery_task_status NOT NULL DEFAULT 'AVAILABLE', payout_minor BIGINT NOT NULL, stop_count INTEGER NOT NULL, assigned_to TEXT REFERENCES users(user_id), scheduled_start TIMESTAMPTZ, scheduled_end TIMESTAMPTZ, distance_km NUMERIC(10,2), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE delivery_stops (stop_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES delivery_tasks(task_id) ON DELETE CASCADE, stop_type TEXT NOT NULL, stop_ref_id TEXT NOT NULL, sequence INTEGER NOT NULL, otp_hash TEXT, otp_expires_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ, confirmation_type TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION);

CREATE TABLE chat_rooms (chat_room_id TEXT PRIMARY KEY, order_id TEXT REFERENCES orders(order_id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE chat_participants (chat_room_id TEXT REFERENCES chat_rooms(chat_room_id) ON DELETE CASCADE, user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE, role role_type NOT NULL, joined_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (chat_room_id, user_id));
CREATE TABLE chat_messages (message_id TEXT PRIMARY KEY, chat_room_id TEXT NOT NULL REFERENCES chat_rooms(chat_room_id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES users(user_id), sender_role role_type NOT NULL, message_type chat_message_type DEFAULT 'TEXT', text TEXT, attachments JSONB, card_payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE payments (payment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, provider TEXT DEFAULT 'stub', method TEXT NOT NULL, status payment_status DEFAULT 'PENDING', provider_ref TEXT, amount_minor BIGINT NOT NULL, currency TEXT DEFAULT 'EGP', idempotency_key TEXT UNIQUE, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE refunds (refund_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, payment_id TEXT, refund_type refund_type NOT NULL, amount_minor BIGINT NOT NULL, components JSONB NOT NULL, reason_code TEXT NOT NULL, notes TEXT, refunded_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE payouts (payout_id TEXT PRIMARY KEY, party_role role_type NOT NULL, party_id TEXT NOT NULL REFERENCES users(user_id), amount_minor BIGINT NOT NULL, currency TEXT DEFAULT 'EGP', period_from DATE NOT NULL, period_to DATE NOT NULL, status TEXT DEFAULT 'PENDING', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE support_tickets (ticket_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, created_by_id TEXT NOT NULL REFERENCES users(user_id), category TEXT NOT NULL, message TEXT NOT NULL, evidence_urls TEXT[] DEFAULT '{}', status ticket_status DEFAULT 'OPEN', assigned_to TEXT REFERENCES users(user_id), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE ratings (rating_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, customer_id TEXT NOT NULL REFERENCES users(user_id), chef_score INTEGER CHECK (chef_score BETWEEN 1 AND 5), delivery_score INTEGER CHECK (delivery_score BETWEEN 1 AND 5), meal_score INTEGER CHECK (meal_score BETWEEN 1 AND 5), comment TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE zones (zone_id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, polygon JSONB NOT NULL, base_delivery_fee_minor BIGINT DEFAULT 2500, per_km_fee_minor BIGINT DEFAULT 500, per_stop_fee_minor BIGINT DEFAULT 300, is_active BOOLEAN DEFAULT TRUE);
CREATE TABLE fee_rules (rule_id TEXT PRIMARY KEY, zone_id TEXT REFERENCES zones(zone_id), platform_fee_pct NUMERIC(5,2) DEFAULT 5.00, threshold_minor BIGINT DEFAULT 100000, above_threshold_pct NUMERIC(5,2) DEFAULT 6.00, promo_active BOOLEAN DEFAULT TRUE, valid_from TIMESTAMPTZ DEFAULT now(), valid_to TIMESTAMPTZ);
CREATE TABLE outbox_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, version TEXT DEFAULT '1.0', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), tenant TEXT DEFAULT 'EG', environment TEXT DEFAULT 'production', correlation_id TEXT, actor JSONB, data JSONB NOT NULL, status TEXT DEFAULT 'PENDING', retry_count INTEGER DEFAULT 0, last_error TEXT);
CREATE INDEX idx_outbox_status ON outbox_events(status, created_at);
