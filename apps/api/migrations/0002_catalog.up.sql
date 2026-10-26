-- 0002: normalized facets, ingredients, dishes, recipe versions/BOM, offer variants, supplier products.
-- Stories: C03-C05, H02, H03, S02. Reviewed rollback: 0002_catalog.down.sql.

CREATE TABLE facets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facet_type text NOT NULL CHECK (facet_type IN ('CUISINE','DISH_TYPE','COURSE','SUPPLIER_CATEGORY','DIET','COLLECTION')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,64}$'),
  label_en text NOT NULL,
  label_ar text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (facet_type, slug),
  UNIQUE (id, facet_type)
);

-- Search aliases ("Grills", "grills", "مشويات") resolve to ONE canonical facet per type.
CREATE TABLE facet_aliases (
  facet_id uuid NOT NULL,
  facet_type text NOT NULL,
  alias_normalized text NOT NULL CHECK (length(alias_normalized) BETWEEN 1 AND 120),
  PRIMARY KEY (facet_type, alias_normalized),
  FOREIGN KEY (facet_id, facet_type) REFERENCES facets(id, facet_type) ON DELETE CASCADE
);

-- Broad discovery collections ("Arabic", "Asian") group precise cuisines; they never replace them.
CREATE TABLE collection_members (
  collection_id uuid NOT NULL,
  collection_type text NOT NULL DEFAULT 'COLLECTION' CHECK (collection_type = 'COLLECTION'),
  cuisine_id uuid NOT NULL,
  cuisine_type text NOT NULL DEFAULT 'CUISINE' CHECK (cuisine_type = 'CUISINE'),
  PRIMARY KEY (collection_id, cuisine_id),
  FOREIGN KEY (collection_id, collection_type) REFERENCES facets(id, facet_type) ON DELETE CASCADE,
  FOREIGN KEY (cuisine_id, cuisine_type) REFERENCES facets(id, facet_type) ON DELETE CASCADE
);

CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,64}$'),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  canonical_unit text NOT NULL CHECK (canonical_unit IN ('g','ml','count')),
  allergens text[] NOT NULL DEFAULT '{}',
  -- UNKNOWN is displayed as unknown, never as "no allergens" (C07).
  allergen_data_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (allergen_data_status IN ('DECLARED','UNKNOWN')),
  specification jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (allergen_data_status = 'DECLARED' OR cardinality(allergens) = 0)
);

CREATE TABLE dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id uuid NOT NULL REFERENCES chefs(id),
  title_en text NOT NULL,
  title_ar text NOT NULL,
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  publication_state text NOT NULL DEFAULT 'DRAFT' CHECK (publication_state IN ('DRAFT','PUBLISHED','UNPUBLISHED','SUSPENDED')),
  published_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, chef_id),
  CHECK (publication_state <> 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE INDEX dishes_chef ON dishes (chef_id);

CREATE TABLE dish_facets (
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  facet_id uuid NOT NULL,
  facet_type text NOT NULL CHECK (facet_type IN ('CUISINE','DISH_TYPE','COURSE','DIET')),
  PRIMARY KEY (dish_id, facet_id),
  FOREIGN KEY (facet_id, facet_type) REFERENCES facets(id, facet_type)
);
CREATE INDEX dish_facets_facet ON dish_facets (facet_id);

CREATE TABLE recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id),
  version integer NOT NULL CHECK (version > 0),
  steps jsonb NOT NULL CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) > 0),
  equipment jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(equipment) = 'array'),
  is_public_recipe boolean NOT NULL DEFAULT false,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dish_id, version),
  UNIQUE (id, dish_id)
);

CREATE TABLE ingredient_requirements (
  recipe_version_id uuid NOT NULL REFERENCES recipe_versions(id),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  quantity_per_serving numeric(14,4) NOT NULL CHECK (quantity_per_serving > 0),
  unit text NOT NULL CHECK (unit IN ('g','ml','count')),
  weight_basis text NOT NULL CHECK (weight_basis IN ('RAW_EDIBLE','AS_PURCHASED','COOKED_NET')),
  is_pantry boolean NOT NULL DEFAULT false,
  allowed_omission boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (recipe_version_id, ingredient_id)
);

-- Published recipe versions and their BOM are immutable (snapshots for future orders, O12).
CREATE FUNCTION guard_published_recipe() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published recipe version % is immutable', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER recipe_versions_immutable BEFORE UPDATE OR DELETE ON recipe_versions
  FOR EACH ROW EXECUTE FUNCTION guard_published_recipe();

CREATE FUNCTION guard_published_requirements() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rv uuid;
BEGIN
  rv := CASE WHEN TG_OP = 'DELETE' THEN OLD.recipe_version_id ELSE NEW.recipe_version_id END;
  IF EXISTS (SELECT 1 FROM recipe_versions WHERE id = rv AND published_at IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM recipe_versions WHERE id = OLD.recipe_version_id AND published_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'ingredients of a published recipe version are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ingredient_requirements_immutable BEFORE INSERT OR UPDATE OR DELETE ON ingredient_requirements
  FOR EACH ROW EXECUTE FUNCTION guard_published_requirements();

CREATE TABLE offer_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES dishes(id),
  recipe_version_id uuid NOT NULL,
  service_mode text NOT NULL CHECK (service_mode IN ('EAT_NOW','HEAT_AT_HOME','COOK_AT_HOME')),
  labor_per_person_piastres bigint NOT NULL CHECK (labor_per_person_piastres >= 0),
  packaging_piastres bigint NOT NULL DEFAULT 0 CHECK (packaging_piastres >= 0),
  chef_ingredients_per_serving_piastres bigint CHECK (chef_ingredients_per_serving_piastres >= 0),
  supplier_sourcing_allowed boolean NOT NULL DEFAULT false,
  lead_time_minutes integer NOT NULL CHECK (lead_time_minutes > 0),
  min_servings integer NOT NULL CHECK (min_servings >= 1),
  max_servings integer NOT NULL,
  serving_step integer NOT NULL DEFAULT 1 CHECK (serving_step >= 1),
  portion_weight_grams integer CHECK (portion_weight_grams > 0),
  portion_weight_basis text CHECK (portion_weight_basis IN ('RAW_EDIBLE','AS_PURCHASED','COOKED_NET')),
  safety_instructions_en text NOT NULL CHECK (length(trim(safety_instructions_en)) > 0),
  safety_instructions_ar text NOT NULL CHECK (length(trim(safety_instructions_ar)) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  price_version integer NOT NULL DEFAULT 1 CHECK (price_version > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (recipe_version_id, dish_id) REFERENCES recipe_versions(id, dish_id),
  CHECK (max_servings >= min_servings),
  CHECK (chef_ingredients_per_serving_piastres IS NOT NULL OR supplier_sourcing_allowed),
  CHECK ((portion_weight_grams IS NULL) = (portion_weight_basis IS NULL))
);
CREATE INDEX offer_variants_dish ON offer_variants (dish_id);
CREATE INDEX offer_variants_mode ON offer_variants (service_mode) WHERE status = 'ACTIVE';

-- Price history: edits never rewrite what an earlier quote/order saw (H02, O12).
CREATE TABLE offer_variant_price_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES offer_variants(id),
  price_version integer NOT NULL,
  labor_per_person_piastres bigint NOT NULL,
  packaging_piastres bigint NOT NULL,
  chef_ingredients_per_serving_piastres bigint,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, price_version)
);
CREATE FUNCTION record_variant_price_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.labor_per_person_piastres, OLD.packaging_piastres, OLD.chef_ingredients_per_serving_piastres)
     IS DISTINCT FROM (NEW.labor_per_person_piastres, NEW.packaging_piastres, NEW.chef_ingredients_per_serving_piastres) THEN
    IF NEW.price_version <> OLD.price_version + 1 THEN
      RAISE EXCEPTION 'price change must increment price_version' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO offer_variant_price_history (variant_id, price_version, labor_per_person_piastres, packaging_piastres, chef_ingredients_per_serving_piastres, valid_from)
    VALUES (OLD.id, OLD.price_version, OLD.labor_per_person_piastres, OLD.packaging_piastres, OLD.chef_ingredients_per_serving_piastres, OLD.updated_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offer_variants_price_history BEFORE UPDATE ON offer_variants
  FOR EACH ROW EXECUTE FUNCTION record_variant_price_history();

-- A dish may only be PUBLISHED by an APPROVED chef (defense in depth for H01/H03).
CREATE FUNCTION guard_dish_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.publication_state = 'PUBLISHED' AND NOT EXISTS (SELECT 1 FROM chefs WHERE id = NEW.chef_id AND status = 'APPROVED') THEN
    RAISE EXCEPTION 'only approved chefs can publish dishes' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER dishes_publication_guard BEFORE INSERT OR UPDATE OF publication_state ON dishes
  FOR EACH ROW EXECUTE FUNCTION guard_dish_publication();

CREATE TABLE supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES supplier_branches(id),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id),
  sku text NOT NULL CHECK (sku ~ '^[A-Za-z0-9._-]{1,64}$'),
  pack_quantity numeric(14,4) NOT NULL CHECK (pack_quantity > 0),
  pack_unit text NOT NULL CHECK (pack_unit IN ('g','ml','count')),
  price_piastres bigint NOT NULL CHECK (price_piastres >= 0),
  price_version integer NOT NULL DEFAULT 1 CHECK (price_version > 0),
  variable_weight boolean NOT NULL DEFAULT false,
  brand text,
  category_facet_id uuid NOT NULL,
  category_facet_type text NOT NULL DEFAULT 'SUPPLIER_CATEGORY' CHECK (category_facet_type = 'SUPPLIER_CATEGORY'),
  minimum_order_packs integer NOT NULL DEFAULT 1 CHECK (minimum_order_packs >= 1),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  is_illustrative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, sku),
  FOREIGN KEY (category_facet_id, category_facet_type) REFERENCES facets(id, facet_type)
);
CREATE INDEX supplier_products_ingredient_branch ON supplier_products (ingredient_id, branch_id);
CREATE INDEX supplier_products_category ON supplier_products (category_facet_id) WHERE status = 'ACTIVE';

-- Pack unit must equal the ingredient's canonical unit: no silent ml<->g conversion.
CREATE FUNCTION guard_product_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ingredients WHERE id = NEW.ingredient_id AND canonical_unit = NEW.pack_unit) THEN
    RAISE EXCEPTION 'pack unit must match the ingredient canonical unit' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supplier_products_unit_guard BEFORE INSERT OR UPDATE OF pack_unit, ingredient_id ON supplier_products
  FOR EACH ROW EXECUTE FUNCTION guard_product_unit();

CREATE FUNCTION guard_requirement_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ingredients WHERE id = NEW.ingredient_id AND canonical_unit = NEW.unit) THEN
    RAISE EXCEPTION 'requirement unit must match the ingredient canonical unit' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ingredient_requirements_unit_guard BEFORE INSERT OR UPDATE ON ingredient_requirements
  FOR EACH ROW EXECUTE FUNCTION guard_requirement_unit();

-- Available stock in packs. Reservations (S03) arrive with checkout in Slice 2.
CREATE TABLE inventory_balances (
  product_id uuid PRIMARY KEY REFERENCES supplier_products(id),
  on_hand_packs integer NOT NULL CHECK (on_hand_packs >= 0),
  reserved_packs integer NOT NULL DEFAULT 0 CHECK (reserved_packs >= 0 AND reserved_packs <= on_hand_packs),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
