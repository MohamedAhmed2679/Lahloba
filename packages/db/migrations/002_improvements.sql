-- Lahloba v1.1 — All improvements migration

-- 1. SEARCH
CREATE TABLE search_sync_log (sync_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, synced_at TIMESTAMPTZ DEFAULT now(), success BOOLEAN DEFAULT TRUE, error TEXT);
CREATE TABLE search_queries (query_id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(user_id), query_text TEXT NOT NULL, results_count INTEGER DEFAULT 0, filters_used JSONB, clicked_meal_id TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_search_q_text ON search_queries(query_text);

-- 2. FAVORITES & REORDER
CREATE TABLE favorites (favorite_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, meal_id TEXT NOT NULL REFERENCES meals(meal_id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, meal_id));
CREATE INDEX idx_fav_user ON favorites(user_id, created_at DESC);
CREATE TABLE reorder_history (reorder_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, original_order_id TEXT NOT NULL REFERENCES orders(order_id), meal_id TEXT NOT NULL REFERENCES meals(meal_id), chef_id TEXT NOT NULL, last_ordered_at TIMESTAMPTZ NOT NULL, order_count INTEGER DEFAULT 1, last_pricing JSONB NOT NULL, last_servings INTEGER DEFAULT 1, UNIQUE(user_id, meal_id, chef_id));
CREATE INDEX idx_reorder_user ON reorder_history(user_id, last_ordered_at DESC);

-- 3. CHEF AVAILABILITY
CREATE TABLE chef_availability_slots (slot_id TEXT PRIMARY KEY, chef_id TEXT NOT NULL REFERENCES chef_profiles(chef_id) ON DELETE CASCADE, day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), start_time TIME NOT NULL, end_time TIME NOT NULL, max_orders INTEGER DEFAULT 5, is_active BOOLEAN DEFAULT TRUE);
CREATE INDEX idx_avail_chef ON chef_availability_slots(chef_id, day_of_week);
CREATE TABLE chef_availability_overrides (override_id TEXT PRIMARY KEY, chef_id TEXT NOT NULL REFERENCES chef_profiles(chef_id) ON DELETE CASCADE, date DATE NOT NULL, is_available BOOLEAN DEFAULT FALSE, start_time TIME, end_time TIME, max_orders INTEGER, reason TEXT, UNIQUE(chef_id, date));
CREATE TABLE chef_blocked_dates (block_id TEXT PRIMARY KEY, chef_id TEXT NOT NULL REFERENCES chef_profiles(chef_id) ON DELETE CASCADE, start_date DATE NOT NULL, end_date DATE NOT NULL, reason TEXT);

-- 4. ETA ML
CREATE TABLE eta_predictions (prediction_id TEXT PRIMARY KEY, order_id TEXT REFERENCES orders(order_id), task_id TEXT, predicted_minutes INTEGER NOT NULL, actual_minutes INTEGER, model_version TEXT DEFAULT 'v1.0', features JSONB NOT NULL, confidence NUMERIC(5,4), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE eta_training_data (sample_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, task_type delivery_task_type NOT NULL, distance_km NUMERIC(10,2) NOT NULL, stop_count INTEGER NOT NULL, hour_of_day INTEGER NOT NULL, day_of_week INTEGER NOT NULL, zone_id TEXT, actual_minutes INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

-- 5. LOYALTY
CREATE TYPE loyalty_tier AS ENUM ('BRONZE','SILVER','GOLD','PLATINUM');
CREATE TYPE points_action AS ENUM ('EARN_ORDER','EARN_REFERRAL','EARN_REVIEW','REDEEM_DISCOUNT','REDEEM_FREE_DELIVERY','EXPIRE','ADJUST');
CREATE TABLE loyalty_accounts (account_id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE, tier loyalty_tier DEFAULT 'BRONZE', total_points INTEGER DEFAULT 0, available_points INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tier_updated_at TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE loyalty_transactions (txn_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES loyalty_accounts(account_id), action points_action NOT NULL, points INTEGER NOT NULL, balance_after INTEGER NOT NULL, reference_type TEXT, reference_id TEXT, description TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_loyalty_txn ON loyalty_transactions(account_id, created_at DESC);
CREATE TABLE loyalty_rewards (reward_id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, description_en TEXT, description_ar TEXT, cost_points INTEGER NOT NULL, reward_type TEXT NOT NULL, reward_value INTEGER NOT NULL, min_order_minor BIGINT DEFAULT 0, min_tier loyalty_tier DEFAULT 'BRONZE', is_active BOOLEAN DEFAULT TRUE, valid_from TIMESTAMPTZ DEFAULT now(), valid_to TIMESTAMPTZ, max_redemptions INTEGER, current_redemptions INTEGER DEFAULT 0);
CREATE TABLE loyalty_redemptions (redemption_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES loyalty_accounts(account_id), reward_id TEXT NOT NULL REFERENCES loyalty_rewards(reward_id), order_id TEXT REFERENCES orders(order_id), points_spent INTEGER NOT NULL, discount_minor BIGINT NOT NULL, status TEXT DEFAULT 'ACTIVE', code TEXT UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE loyalty_tier_config (tier loyalty_tier PRIMARY KEY, min_lifetime_points INTEGER NOT NULL, points_per_egp NUMERIC(5,2) DEFAULT 1.00, bonus_multiplier NUMERIC(3,2) DEFAULT 1.00, perks JSONB);
INSERT INTO loyalty_tier_config VALUES ('BRONZE',0,1.00,1.00,'{"free_delivery_per_month":0}'), ('SILVER',5000,1.00,1.25,'{"free_delivery_per_month":1}'), ('GOLD',15000,1.00,1.50,'{"free_delivery_per_month":3,"priority_support":true}'), ('PLATINUM',50000,1.00,2.00,'{"free_delivery_per_month":5,"priority_support":true,"exclusive_chefs":true}');

-- 6. ROUTE OPTIMIZATION
CREATE TABLE route_plans (plan_id TEXT PRIMARY KEY, zone_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), status TEXT DEFAULT 'DRAFT', total_distance_km NUMERIC(10,2), total_time_min INTEGER, tasks_count INTEGER DEFAULT 0, optimization_score NUMERIC(5,4));
CREATE TABLE route_plan_tasks (plan_id TEXT NOT NULL REFERENCES route_plans(plan_id) ON DELETE CASCADE, task_id TEXT NOT NULL REFERENCES delivery_tasks(task_id), sequence INTEGER NOT NULL, segment_distance_km NUMERIC(10,2), segment_time_min INTEGER, PRIMARY KEY (plan_id, task_id));
CREATE TABLE route_optimization_log (log_id TEXT PRIMARY KEY, zone_id TEXT NOT NULL, algorithm TEXT DEFAULT 'nearest_neighbor', tasks_input INTEGER NOT NULL, tasks_batched INTEGER NOT NULL, distance_saved_km NUMERIC(10,2), time_saved_min INTEGER, computation_ms INTEGER, created_at TIMESTAMPTZ DEFAULT now());

-- 9. ACCESSIBILITY
CREATE TABLE accessibility_preferences (user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE, high_contrast BOOLEAN DEFAULT FALSE, large_text BOOLEAN DEFAULT FALSE, reduce_motion BOOLEAN DEFAULT FALSE, screen_reader BOOLEAN DEFAULT FALSE, text_scale NUMERIC(3,2) DEFAULT 1.00, updated_at TIMESTAMPTZ DEFAULT now());

-- 10. ANALYTICS
CREATE TABLE analytics_daily_chef (id TEXT PRIMARY KEY, chef_id TEXT NOT NULL, date DATE NOT NULL, orders_received INTEGER DEFAULT 0, orders_completed INTEGER DEFAULT 0, orders_cancelled INTEGER DEFAULT 0, revenue_minor BIGINT DEFAULT 0, avg_prep_time_min INTEGER, avg_rating NUMERIC(3,2), top_meal_id TEXT, peak_hour INTEGER, UNIQUE(chef_id, date));
CREATE TABLE analytics_daily_store (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, date DATE NOT NULL, baskets_received INTEGER DEFAULT 0, baskets_completed INTEGER DEFAULT 0, substitutions_proposed INTEGER DEFAULT 0, substitutions_approved INTEGER DEFAULT 0, revenue_minor BIGINT DEFAULT 0, avg_pack_time_min INTEGER, out_of_stock_count INTEGER DEFAULT 0, peak_hour INTEGER, UNIQUE(store_id, date));
CREATE TABLE analytics_hourly_orders (id TEXT PRIMARY KEY, zone_id TEXT, date DATE NOT NULL, hour INTEGER NOT NULL, orders_count INTEGER DEFAULT 0, gmv_minor BIGINT DEFAULT 0, avg_delivery_min INTEGER, cancellation_count INTEGER DEFAULT 0, UNIQUE(zone_id, date, hour));

-- REFERRALS
CREATE TABLE referrals (referral_id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL REFERENCES users(user_id), referee_id TEXT NOT NULL REFERENCES users(user_id), referral_code TEXT NOT NULL, bonus_points INTEGER DEFAULT 500, status TEXT DEFAULT 'PENDING', completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(referrer_id, referee_id));
