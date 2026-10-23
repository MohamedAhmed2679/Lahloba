import { createHash } from 'node:crypto';
import type { DbClient } from '../db';
import { seedReference, type Ids } from './reference';

/**
 * ILLUSTRATIVE DEVELOPMENT/TEST DATA ONLY.
 * Every partner below is fictional, flagged is_illustrative, and named "(sample)". Prices are
 * invented for UI testing and are NOT market estimates. No verification badges are created;
 * "APPROVED" here only lets the sample appear in local discovery.
 * Identities use the dev: namespace and can only sign in through the dev identity stub.
 */
export const SAMPLE_SUBJECTS = {
  seedSystem: 'dev:seed-system',
  chefA: 'dev:sample-chef-a',
  chefB: 'dev:sample-chef-b',
  supplier: 'dev:sample-supplier',
  opsReviewer: 'dev:sample-ops-reviewer',
} as const;

async function user(db: DbClient, subject: string, name: string) {
  const r = await db.query(`INSERT INTO app_users (identity_subject, display_name) VALUES ($1, $2) RETURNING id`, [subject, name]);
  const id = r.rows[0].id as string;
  await db.query(`INSERT INTO role_memberships (user_id, role, scope_type, approval_state) VALUES ($1, 'CUSTOMER', 'GLOBAL', 'APPROVED')`, [id]);
  return id;
}

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export async function seedIllustrative(db: DbClient) {
  const ref = await seedReference(db);
  const { area, facet, ingredient: ing } = ref;
  const system = await user(db, SAMPLE_SUBJECTS.seedSystem, 'Seed system (dev)');

  const ops = await user(db, SAMPLE_SUBJECTS.opsReviewer, 'Sample ops reviewer (dev)');
  await db.query(`INSERT INTO role_memberships (user_id, role, scope_type, approval_state, granted_by) VALUES ($1, 'OPS_VERIFIER', 'GLOBAL', 'APPROVED', $2)`, [ops, system]);

  const chefs: Ids = {};
  const makeChef = async (key: string, subject: string, name: string, homeArea: string, serves: string[], accepting: boolean) => {
    const owner = await user(db, subject, name);
    const addr = await db.query(`INSERT INTO private_addresses (owner_user_id, address_text, area_id) VALUES ($1, $2, $3) RETURNING id`, [owner, `PRIVATE sample kitchen address for ${name}`, area[homeArea]]);
    const c = await db.query(
      `INSERT INTO chefs (owner_user_id, public_name, public_bio_en, public_bio_ar, public_area_id, kitchen_address_id, status, accepting_orders, is_illustrative)
       VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', $7, true) RETURNING id`,
      [owner, name, 'Illustrative sample kitchen for development.', 'مطبخ توضيحي للتجربة أثناء التطوير.', area[homeArea], addr.rows[0].id, accepting],
    );
    chefs[key] = c.rows[0].id;
    await db.query(`INSERT INTO role_memberships (user_id, role, scope_type, scope_id, approval_state, granted_by) VALUES ($1, 'CHEF_OWNER', 'CHEF', $2, 'APPROVED', $3)`, [owner, c.rows[0].id, system]);
    for (const s of serves) await db.query(`INSERT INTO chef_service_areas (chef_id, area_id) VALUES ($1, $2)`, [c.rows[0].id, area[s]]);
    chefs[`${key}:owner`] = owner;
  };
  await makeChef('A', SAMPLE_SUBJECTS.chefA, 'Sample Kitchen A (sample)', 'maadi', ['maadi', 'nasr-city'], true);
  await makeChef('B', SAMPLE_SUBJECTS.chefB, 'Sample Kitchen B (sample)', 'heliopolis', ['heliopolis', 'maadi'], false);

  const dishes: Ids = {};
  const offers: Ids = {};
  type Req = [string, number, 'RAW_EDIBLE' | 'AS_PURCHASED' | 'COOKED_NET', boolean?];
  const makeDish = async (o: {
    key: string; chef: string; en: string; ar: string; facets: string[]; publish: boolean; publicRecipe?: boolean;
    reqs: Req[]; variants: Array<{ key: string; mode: 'EAT_NOW' | 'HEAT_AT_HOME' | 'COOK_AT_HOME'; labor: number; packaging: number; chefIngr: number | null; suppliers: boolean; lead: number; min: number; max: number; step?: number; portion?: number; units?: [number, number]; en: string; ar: string }>;
  }) => {
    const d = await db.query(`INSERT INTO dishes (chef_id, title_en, title_ar, description_en, description_ar) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [chefs[o.chef], o.en, o.ar, `Illustrative sample dish: ${o.en}.`, `طبق توضيحي للتجربة: ${o.ar}.`]);
    const dishId = d.rows[0].id as string;
    dishes[o.key] = dishId;
    for (const f of o.facets) {
      const [type] = f.split(':');
      await db.query(`INSERT INTO dish_facets (dish_id, facet_id, facet_type) VALUES ($1,$2,$3)`, [dishId, facet[f], type]);
    }
    const steps = [{ en: 'Illustrative step: prepare ingredients.', ar: 'خطوة توضيحية: جهّز المكوّنات.' }, { en: 'Illustrative step: cook and serve.', ar: 'خطوة توضيحية: اطبخ وقدّم.' }];
    const rv = await db.query(`INSERT INTO recipe_versions (dish_id, version, steps, equipment, is_public_recipe, content_hash) VALUES ($1, 1, $2, '[]', $3, $4) RETURNING id`,
      [dishId, JSON.stringify(steps), o.publicRecipe ?? false, hash([o.key, steps, o.reqs])]);
    const rvId = rv.rows[0].id as string;
    let i = 0;
    for (const [slug, qty, basis, pantry] of o.reqs) {
      const unit = (await db.query(`SELECT canonical_unit FROM ingredients WHERE id = $1`, [ing[slug]])).rows[0].canonical_unit;
      await db.query(`INSERT INTO ingredient_requirements (recipe_version_id, ingredient_id, quantity_per_serving, unit, weight_basis, is_pantry, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rvId, ing[slug], qty, unit, basis, pantry ?? false, i++]);
    }
    await db.query(`UPDATE recipe_versions SET published_at = now() WHERE id = $1`, [rvId]);
    for (const v of o.variants) {
      const r = await db.query(
        `INSERT INTO offer_variants (dish_id, recipe_version_id, service_mode, labor_per_person_piastres, packaging_piastres, chef_ingredients_per_serving_piastres,
           supplier_sourcing_allowed, lead_time_minutes, min_servings, max_servings, serving_step, portion_weight_grams, portion_weight_basis, safety_instructions_en, safety_instructions_ar,
           base_work_units, work_units_per_serving)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [dishId, rvId, v.mode, v.labor, v.packaging, v.chefIngr, v.suppliers, v.lead, v.min, v.max, v.step ?? 1, v.portion ?? null, v.portion ? 'COOKED_NET' : null, v.en, v.ar,
          v.units?.[0] ?? 2, v.units?.[1] ?? 2],
      );
      offers[v.key] = r.rows[0].id;
    }
    if (o.publish) await db.query(`UPDATE dishes SET publication_state = 'PUBLISHED', published_at = now() WHERE id = $1`, [dishId]);
  };

  const eatNow = { en: 'Illustrative: eat within the time stated on the label. Final guidance requires food-safety review.', ar: 'توضيحي: يؤكل خلال المدة المذكورة على الملصق. التعليمات النهائية تحتاج مراجعة سلامة غذائية.' };
  const heat = { en: 'Illustrative: keep chilled; reheat until steaming hot. Final guidance requires food-safety review.', ar: 'توضيحي: يُحفظ مبردًا ويُسخّن جيدًا حتى يتصاعد البخار. التعليمات النهائية تحتاج مراجعة سلامة غذائية.' };
  const kit = { en: 'Illustrative: contains uncooked ingredients. Follow the included steps; keep raw chicken chilled.', ar: 'توضيحي: يحتوي على مكوّنات غير مطبوخة. اتبع الخطوات المرفقة واحفظ الدجاج النيء مبردًا.' };

  // Founder example: cooking fee 10 EGP per person.
  await makeDish({
    key: 'molokhia', chef: 'A', en: 'Molokhia with chicken', ar: 'ملوخية بالفراخ', publish: true,
    facets: ['CUISINE:egyptian', 'COURSE:main-course', 'DISH_TYPE:stews'],
    reqs: [['chicken-raw', 150, 'RAW_EDIBLE'], ['molokhia-leaves', 100, 'AS_PURCHASED'], ['garlic', 5, 'RAW_EDIBLE'], ['ghee', 10, 'AS_PURCHASED', true], ['salt', 2, 'AS_PURCHASED', true], ['rice-egyptian', 80, 'AS_PURCHASED']],
    variants: [
      { key: 'molokhia-eat', mode: 'EAT_NOW', labor: 1000, packaging: 300, chefIngr: 6000, suppliers: true, lead: 120, min: 2, max: 8, portion: 450, ...eatNow },
      { key: 'molokhia-heat', mode: 'HEAT_AT_HOME', labor: 1000, packaging: 500, chefIngr: 6000, suppliers: true, lead: 180, min: 2, max: 8, portion: 450, ...heat },
      { key: 'molokhia-kit', mode: 'COOK_AT_HOME', labor: 600, packaging: 400, chefIngr: 6000, suppliers: false, lead: 90, min: 2, max: 6, step: 2, ...kit },
    ],
  });
  await makeDish({
    key: 'koshari', chef: 'A', en: 'Koshari', ar: 'كشري', publish: true,
    facets: ['CUISINE:egyptian', 'DIET:vegetarian', 'COURSE:main-course'],
    reqs: [['rice-egyptian', 80, 'AS_PURCHASED'], ['lentils-brown', 50, 'AS_PURCHASED'], ['macaroni', 60, 'AS_PURCHASED'], ['tomato', 100, 'RAW_EDIBLE'], ['onion', 60, 'RAW_EDIBLE'], ['vegetable-oil', 20, 'AS_PURCHASED', true]],
    variants: [{ key: 'koshari-eat', mode: 'EAT_NOW', labor: 800, packaging: 300, chefIngr: 3500, suppliers: true, lead: 90, min: 1, max: 10, portion: 500, ...eatNow }],
  });
  await makeDish({
    key: 'lentil-soup', chef: 'A', en: 'Red lentil soup', ar: 'شوربة عدس', publish: true, publicRecipe: true,
    facets: ['CUISINE:egyptian', 'DISH_TYPE:soup', 'DIET:vegetarian'],
    reqs: [['lentils-red', 70, 'AS_PURCHASED'], ['onion', 40, 'RAW_EDIBLE'], ['garlic', 3, 'RAW_EDIBLE'], ['spice-mix', 2, 'AS_PURCHASED', true]],
    variants: [{ key: 'lentil-kit', mode: 'COOK_AT_HOME', labor: 500, packaging: 200, chefIngr: 1500, suppliers: true, lead: 60, min: 2, max: 8, ...kit }],
  });
  await makeDish({
    key: 'pasta', chef: 'A', en: 'Pasta in tomato sauce', ar: 'مكرونة بالصلصة', publish: true,
    facets: ['CUISINE:italian', 'DISH_TYPE:pasta', 'DIET:vegetarian'],
    reqs: [['macaroni', 120, 'AS_PURCHASED'], ['tomato', 150, 'RAW_EDIBLE'], ['garlic', 4, 'RAW_EDIBLE'], ['vegetable-oil', 15, 'AS_PURCHASED', true]],
    variants: [{ key: 'pasta-eat', mode: 'EAT_NOW', labor: 900, packaging: 300, chefIngr: 2500, suppliers: false, lead: 60, min: 1, max: 6, ...eatNow }],
  });
  await makeDish({
    key: 'draft-mandi', chef: 'A', en: 'Chicken mandi (draft)', ar: 'مندي فراخ (مسودة)', publish: false,
    facets: ['CUISINE:levantine', 'DISH_TYPE:mandi'],
    reqs: [['chicken-raw', 200, 'RAW_EDIBLE'], ['rice-egyptian', 100, 'AS_PURCHASED']],
    variants: [{ key: 'mandi-eat', mode: 'EAT_NOW', labor: 1500, packaging: 400, chefIngr: 9000, suppliers: true, lead: 150, min: 2, max: 6, ...eatNow }],
  });
  // Chef B is approved but NOT accepting orders: excluded from discovery results (C04).
  await makeDish({
    key: 'tawook', chef: 'B', en: 'Shish tawook', ar: 'شيش طاووق', publish: true,
    facets: ['CUISINE:levantine', 'DISH_TYPE:grills'],
    reqs: [['chicken-raw', 180, 'RAW_EDIBLE'], ['yogurt', 30, 'AS_PURCHASED'], ['garlic', 5, 'RAW_EDIBLE']],
    variants: [{ key: 'tawook-eat', mode: 'EAT_NOW', labor: 1200, packaging: 300, chefIngr: 7000, suppliers: true, lead: 90, min: 1, max: 8, ...eatNow }],
  });

  // Illustrative capacity: two service windows a day for chef A over the booking window
  // (Cairo local 12:00-15:00 and 18:00-21:00), 40 work units each. Chef B has none.
  await db.query(
    `INSERT INTO chef_capacity_slots (chef_id, starts_at, ends_at, total_work_units)
     SELECT $1, (d + w.s) AT TIME ZONE 'Africa/Cairo', (d + w.e) AT TIME ZONE 'Africa/Cairo', 40
     FROM generate_series(date_trunc('day', now() AT TIME ZONE 'Africa/Cairo'), date_trunc('day', now() AT TIME ZONE 'Africa/Cairo') + interval '6 days', interval '1 day') d
     CROSS JOIN (VALUES (interval '12 hours', interval '15 hours'), (interval '18 hours', interval '21 hours')) w(s, e)
     WHERE (d + w.s) AT TIME ZONE 'Africa/Cairo' > now() + interval '3 hours'`,
    [chefs.A],
  );

  // Illustrative delivery tariffs between public areas. Distance bands are an OPEN founder decision;
  // these values only exercise the rules (final 20-75 EGP, ingredient trip 20 EGP when eligible).
  const tariff = async (kind: 'FINAL' | 'INGREDIENT', from: string, to: string, fee: number, eligible = true, maxStops = 1) =>
    db.query(`INSERT INTO delivery_tariffs (kind, from_area_id, to_area_id, fee_piastres, eligible, max_stops, is_illustrative) VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [kind, area[from], area[to], fee, eligible, maxStops]);
  const pairs: Array<[string, string, number]> = [
    ['maadi', 'maadi', 2500], ['nasr-city', 'nasr-city', 2500], ['heliopolis', 'heliopolis', 2500],
    ['maadi', 'nasr-city', 4500], ['nasr-city', 'maadi', 4500], ['maadi', 'heliopolis', 5500], ['heliopolis', 'maadi', 5500],
    ['nasr-city', 'heliopolis', 3000], ['heliopolis', 'nasr-city', 3000],
  ];
  for (const [f, t, fee] of pairs) await tariff('FINAL', f, t, fee);
  for (const [f, t] of [['maadi', 'maadi'], ['nasr-city', 'nasr-city'], ['nasr-city', 'maadi'], ['maadi', 'nasr-city'], ['heliopolis', 'heliopolis']] as const) {
    await tariff('INGREDIENT', f, t, 2000, true, 3);
  }
  await tariff('INGREDIENT', 'maadi', 'heliopolis', 0, false);

  // Illustrative supplier.
  const supOwner = await user(db, SAMPLE_SUBJECTS.supplier, 'Sample Grocer (sample)');
  const org = await db.query(`INSERT INTO supplier_organizations (owner_user_id, public_name, status, is_illustrative) VALUES ($1, 'Sample Grocer (sample)', 'APPROVED', true) RETURNING id`, [supOwner]);
  await db.query(`INSERT INTO role_memberships (user_id, role, scope_type, scope_id, approval_state, granted_by) VALUES ($1, 'SUPPLIER_OWNER', 'SUPPLIER_ORG', $2, 'APPROVED', $3)`, [supOwner, org.rows[0].id, system]);
  const baddr = await db.query(`INSERT INTO private_addresses (owner_user_id, address_text, area_id) VALUES ($1, 'PRIVATE sample branch address', $2) RETURNING id`, [supOwner, area.maadi]);
  const branch = await db.query(
    `INSERT INTO supplier_branches (organization_id, public_name, area_id, address_id, status, is_open, is_illustrative) VALUES ($1, 'Sample Grocer — Maadi branch (sample)', $2, $3, 'APPROVED', true, true) RETURNING id`,
    [org.rows[0].id, area.maadi, baddr.rows[0].id],
  );
  const branchId = branch.rows[0].id as string;
  for (const s of ['maadi', 'nasr-city']) await db.query(`INSERT INTO supplier_branch_service_areas (branch_id, area_id) VALUES ($1, $2)`, [branchId, area[s]]);
  const products: Ids = {};
  const product = async (key: string, slug: string, sku: string, pack: number, price: number, cat: string, packs: number, variable = false) => {
    const unit = (await db.query(`SELECT canonical_unit FROM ingredients WHERE id = $1`, [ing[slug]])).rows[0].canonical_unit;
    const p = await db.query(
      `INSERT INTO supplier_products (branch_id, ingredient_id, sku, pack_quantity, pack_unit, price_piastres, variable_weight, category_facet_id, is_illustrative)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id`,
      [branchId, ing[slug], sku, pack, unit, price, variable, facet[`SUPPLIER_CATEGORY:${cat}`]],
    );
    products[key] = p.rows[0].id;
    await db.query(`INSERT INTO inventory_balances (product_id, on_hand_packs) VALUES ($1, $2)`, [p.rows[0].id, packs]);
  };
  await product('chicken', 'chicken-raw', 'SAMPLE-CHICKEN-500', 500, 9000, 'butcher', 20, true);
  await product('rice', 'rice-egyptian', 'SAMPLE-RICE-1KG', 1000, 6000, 'pantry', 40);
  await product('molokhia', 'molokhia-leaves', 'SAMPLE-MOLOKHIA-400', 400, 3500, 'grocery', 15);
  await product('tomato', 'tomato', 'SAMPLE-TOMATO-1KG', 1000, 2500, 'produce', 30, true);
  await product('lentils', 'lentils-red', 'SAMPLE-LENTIL-500', 500, 4000, 'pantry', 0); // out of stock: hidden
  await product('bread', 'baladi-bread', 'SAMPLE-BREAD-5', 5, 500, 'bakery', 50);

  return { ...ref, users: { system, ops, supplierOwner: supOwner, chefAOwner: chefs['A:owner']!, chefBOwner: chefs['B:owner']! }, chefs, dishes, offers, branchId, organizationId: org.rows[0].id as string, products };
}

export type SeedResult = Awaited<ReturnType<typeof seedIllustrative>>;
