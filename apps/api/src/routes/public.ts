import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import type { RouteContext } from '../app';
import type { Queryable } from '../db';
import { HttpError, notFound } from '../errors';

/**
 * Anonymous catalog. Every response is parsed through a public contract schema, which strips
 * any column not in the contract (private addresses, owner IDs, evidence keys).
 * Eligibility: dish PUBLISHED, recipe version published, variant ACTIVE, chef APPROVED and
 * accepting orders, chef owner membership APPROVED, owner account ACTIVE, chef serves the area,
 * and the area is ACTIVE with physical ordering enabled.
 */

const toArray = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const L = (en: string | null, ar: string | null) => ({ en: en ?? '', ar: ar ?? '' });

const ELIGIBLE_CHEF = `
  c.status = 'APPROVED'
  AND EXISTS (SELECT 1 FROM app_users u WHERE u.id = c.owner_user_id AND u.status = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM role_memberships rm WHERE rm.scope_type = 'CHEF' AND rm.scope_id = c.id
              AND rm.role = 'CHEF_OWNER' AND rm.approval_state = 'APPROVED')`;

const ELIGIBLE_OFFER_FROM = `
  FROM offer_variants ov
  JOIN dishes d ON d.id = ov.dish_id AND d.publication_state = 'PUBLISHED'
  JOIN recipe_versions rv ON rv.id = ov.recipe_version_id AND rv.published_at IS NOT NULL
  JOIN chefs c ON c.id = d.chef_id
  JOIN service_areas pa ON pa.id = c.public_area_id
  WHERE ov.status = 'ACTIVE' AND ${ELIGIBLE_CHEF}`;

type AreaRow = { id: string; status: string; physical_ordering_enabled: boolean };

async function loadArea(db: Queryable, areaId: string): Promise<AreaRow> {
  const r = await db.query<AreaRow>(`SELECT id, status, physical_ordering_enabled FROM service_areas WHERE id = $1 AND status <> 'INACTIVE'`, [areaId]);
  const row = r.rows[0];
  if (!row) throw new HttpError(404, 'AREA_NOT_FOUND', 'Area not found');
  return row;
}
const serviceable = (a: AreaRow) => a.status === 'ACTIVE' && a.physical_ordering_enabled;

/** Resolves cuisine/dish-type slugs; collection slugs expand to their member cuisines. */
async function resolveFacetIds(db: Queryable, type: 'CUISINE' | 'DISH_TYPE', slugs: string[]): Promise<string[] | null> {
  if (slugs.length === 0) return null;
  const r = await db.query<{ id: string }>(
    type === 'CUISINE'
      ? `SELECT f.id FROM facets f WHERE f.facet_type = 'CUISINE' AND f.slug = ANY($1)
         UNION SELECT cm.cuisine_id FROM collection_members cm JOIN facets col ON col.id = cm.collection_id
         WHERE col.slug = ANY($1)`
      : `SELECT id FROM facets WHERE facet_type = 'DISH_TYPE' AND slug = ANY($1)`,
    [slugs],
  );
  return r.rows.map((x) => x.id);
}

function encodeCursor(title: string, id: string) {
  return Buffer.from(JSON.stringify([title, id])).toString('base64url');
}
function decodeCursor(c: string | undefined): [string, string] | null {
  if (!c) return null;
  try {
    const v = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (Array.isArray(v) && typeof v[0] === 'string' && z.string().uuid().safeParse(v[1]).success) return [v[0], v[1]];
  } catch { /* fallthrough */ }
  throw new HttpError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
}

async function cuisinesByDish(db: Queryable, dishIds: string[]) {
  const map = new Map<string, Array<{ slug: string; label: { en: string; ar: string } }>>();
  if (!dishIds.length) return map;
  const r = await db.query<{ dish_id: string; slug: string; label_en: string; label_ar: string }>(
    `SELECT df.dish_id, f.slug, f.label_en, f.label_ar FROM dish_facets df JOIN facets f ON f.id = df.facet_id
     WHERE df.dish_id = ANY($1) AND f.facet_type = 'CUISINE' ORDER BY f.sort_order, f.slug`,
    [dishIds],
  );
  for (const row of r.rows) {
    const list = map.get(row.dish_id) ?? [];
    list.push({ slug: row.slug, label: L(row.label_en, row.label_ar) });
    map.set(row.dish_id, list);
  }
  return map;
}

type OfferRow = {
  offer_id: string; dish_id: string; title_en: string; title_ar: string; service_mode: string; labor: number;
  lead_time_minutes: number; min_servings: number; chef_id: string; public_name: string; area_en: string; area_ar: string; illustrative: boolean;
};
const OFFER_COLUMNS = `ov.id AS offer_id, d.id AS dish_id, d.title_en, d.title_ar, ov.service_mode, ov.labor_per_person_piastres AS labor,
  ov.lead_time_minutes, ov.min_servings, c.id AS chef_id, c.public_name, pa.label_en AS area_en, pa.label_ar AS area_ar, c.is_illustrative AS illustrative`;

async function toCards(db: Queryable, rows: OfferRow[]): Promise<C.OfferCard[]> {
  const cuisines = await cuisinesByDish(db, [...new Set(rows.map((r) => r.dish_id))]);
  return rows.map((r) => ({
    offerId: r.offer_id, dishId: r.dish_id, title: L(r.title_en, r.title_ar), serviceMode: r.service_mode as C.OfferCard['serviceMode'],
    chef: { id: r.chef_id, publicName: r.public_name, area: L(r.area_en, r.area_ar) },
    laborPerPersonPiastres: r.labor, leadTimeMinutes: r.lead_time_minutes, minServings: r.min_servings,
    cuisines: cuisines.get(r.dish_id) ?? [], illustrative: r.illustrative,
  }));
}

export function registerPublicRoutes(app: FastifyInstance, ctx: RouteContext) {
  const { pool } = ctx;

  app.get('/v1/areas', async () => {
    const r = await pool.query(
      `SELECT id, slug, label_en, label_ar, status, physical_ordering_enabled FROM service_areas
       WHERE status IN ('ACTIVE','COMING_SOON') ORDER BY sort_order, label_en`,
    );
    return C.AreaList.parse({
      items: r.rows.map((a) => ({ id: a.id, slug: a.slug, label: L(a.label_en, a.label_ar), status: a.status, physicalOrderingEnabled: a.physical_ordering_enabled })),
    });
  });

  app.get('/v1/facets', async (req) => {
    const q = z.object({ type: C.FacetTypeSchema.optional() }).parse(req.query);
    const r = await pool.query(
      `SELECT id, facet_type, slug, label_en, label_ar FROM facets WHERE ($1::text IS NULL OR facet_type = $1)
       ORDER BY facet_type, sort_order, slug`,
      [q.type ?? null],
    );
    return C.FacetList.parse({ items: r.rows.map((f) => ({ id: f.id, type: f.facet_type, slug: f.slug, label: L(f.label_en, f.label_ar) })) });
  });

  app.get('/v1/ingredients', async () => {
    const r = await pool.query(`SELECT id, slug, name_en, name_ar, canonical_unit, allergens, allergen_data_status FROM ingredients ORDER BY slug`);
    return C.IngredientList.parse({
      items: r.rows.map((i) => ({ id: i.id, slug: i.slug, name: L(i.name_en, i.name_ar), unit: i.canonical_unit, allergens: i.allergens, allergenDataStatus: i.allergen_data_status })),
    });
  });

  // C03/C04: nearby, serviceable, filtered offers with independent facet counts.
  app.get('/v1/catalog/offers', async (req) => {
    const raw = req.query as Record<string, unknown>;
    const q = C.OfferSearchQuery.parse({ ...raw, cuisine: toArray(raw.cuisine), dishType: toArray(raw.dishType) });
    const area = await loadArea(pool, q.area);
    const empty = { items: [], facetCounts: { cuisine: [], dishType: [] }, nextCursor: null };
    if (!serviceable(area)) return C.OfferSearchResponse.parse({ serviceability: 'UNSUPPORTED_AREA', ...empty });

    const cuisineIds = await resolveFacetIds(pool, 'CUISINE', q.cuisine);
    const dishTypeIds = await resolveFacetIds(pool, 'DISH_TYPE', q.dishType);
    const base = `${ELIGIBLE_OFFER_FROM} AND ov.service_mode = $2
      AND EXISTS (SELECT 1 FROM chef_service_areas csa WHERE csa.chef_id = c.id AND csa.area_id = $1)
      AND c.accepting_orders`;
    const cuisineCond = (p: string) => `AND ($${p}::uuid[] IS NULL OR EXISTS (SELECT 1 FROM dish_facets df WHERE df.dish_id = d.id AND df.facet_id = ANY($${p}::uuid[])))`;
    const dishCond = (p: string) => `AND ($${p}::uuid[] IS NULL OR EXISTS (SELECT 1 FROM dish_facets df WHERE df.dish_id = d.id AND df.facet_id = ANY($${p}::uuid[])))`;

    const cursor = decodeCursor(q.cursor);
    const rows = await pool.query<OfferRow & { sort_key: string }>(
      `SELECT ${OFFER_COLUMNS}, lower(d.title_en) AS sort_key ${base} ${cuisineCond('3')} ${dishCond('4')}
       AND ($5::text IS NULL OR (lower(d.title_en), ov.id) > ($5::text, $6::uuid))
       ORDER BY lower(d.title_en), ov.id LIMIT $7`,
      [q.area, q.mode, cuisineIds, dishTypeIds, cursor?.[0] ?? null, cursor?.[1] ?? null, q.limit + 1],
    );
    const page = rows.rows.slice(0, q.limit);
    const last = page[page.length - 1];
    const nextCursor = rows.rows.length > q.limit && last ? encodeCursor(last.sort_key, last.offer_id) : null;

    // Counts for each dimension apply the OTHER dimension's selection (standard faceting).
    const counts = async (type: 'CUISINE' | 'DISH_TYPE', otherIds: string[] | null, otherCond: string) => {
      const r = await pool.query<{ facet_id: string; slug: string; label_en: string; label_ar: string; count: number }>(
        `SELECT f.id AS facet_id, f.slug, f.label_en, f.label_ar, count(DISTINCT e.offer_id)::int AS count
         FROM facets f
         JOIN dish_facets dfx ON dfx.facet_id = f.id
         JOIN (SELECT ov.id AS offer_id, d.id AS dish_id ${base} ${otherCond}) e ON e.dish_id = dfx.dish_id
         WHERE f.facet_type = $4
         GROUP BY f.id, f.slug, f.label_en, f.label_ar, f.sort_order ORDER BY f.sort_order, f.slug`,
        [q.area, q.mode, otherIds, type],
      );
      return r.rows.map((x) => ({ facetId: x.facet_id, slug: x.slug, label: L(x.label_en, x.label_ar), count: x.count }));
    };
    const [cuisineCounts, dishTypeCounts] = await Promise.all([
      counts('CUISINE', dishTypeIds, dishCond('3')),
      counts('DISH_TYPE', cuisineIds, cuisineCond('3')),
    ]);

    return C.OfferSearchResponse.parse({
      serviceability: 'SERVICEABLE',
      items: await toCards(pool, page),
      facetCounts: { cuisine: cuisineCounts, dishType: dishTypeCounts },
      nextCursor,
    });
  });

  // Public chef profile. Never exposes the kitchen address; suspended/unapproved chefs are 404.
  app.get('/v1/chefs/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await pool.query(
      `SELECT c.id, c.public_name, c.public_bio_en, c.public_bio_ar, c.accepting_orders, c.is_illustrative,
              pa.label_en AS area_en, pa.label_ar AS area_ar
       FROM chefs c JOIN service_areas pa ON pa.id = c.public_area_id WHERE c.id = $1 AND ${ELIGIBLE_CHEF}`,
      [id],
    );
    const chef = r.rows[0];
    if (!chef) throw notFound('Chef');
    const offers = await pool.query<OfferRow>(
      `SELECT ${OFFER_COLUMNS} ${ELIGIBLE_OFFER_FROM} AND c.id = $1 ORDER BY lower(d.title_en), ov.service_mode, ov.id LIMIT 100`,
      [id],
    );
    return C.PublicChef.parse({
      id: chef.id, publicName: chef.public_name, bio: L(chef.public_bio_en, chef.public_bio_ar), area: L(chef.area_en, chef.area_ar),
      acceptingOrders: chef.accepting_orders, verifiedClaims: [], illustrative: chef.is_illustrative,
      offers: await toCards(pool, offers.rows),
    });
  });

  // C05/C06/C07: variant detail with ingredient transparency.
  app.get('/v1/offers/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await pool.query(
      `SELECT ${OFFER_COLUMNS}, d.description_en, d.description_ar, c.accepting_orders, ov.packaging_piastres,
              ov.chef_ingredients_per_serving_piastres, ov.supplier_sourcing_allowed, ov.max_servings, ov.serving_step,
              ov.portion_weight_grams, ov.portion_weight_basis, ov.safety_instructions_en, ov.safety_instructions_ar,
              rv.id AS recipe_version_id, rv.version AS recipe_version
       ${ELIGIBLE_OFFER_FROM} AND ov.id = $1`,
      [id],
    );
    const o = r.rows[0];
    if (!o) throw notFound('Offer');
    const [ingredients, siblings, cuisines] = await Promise.all([
      loadIngredients(pool, o.recipe_version_id),
      pool.query(`SELECT id, service_mode FROM offer_variants WHERE dish_id = $1 AND status = 'ACTIVE' AND id <> $2 ORDER BY service_mode`, [o.dish_id, id]),
      cuisinesByDish(pool, [o.dish_id]),
    ]);
    return C.OfferDetail.parse({
      offerId: o.offer_id, dishId: o.dish_id, title: L(o.title_en, o.title_ar), description: L(o.description_en, o.description_ar),
      serviceMode: o.service_mode,
      chef: { id: o.chef_id, publicName: o.public_name, area: L(o.area_en, o.area_ar), acceptingOrders: o.accepting_orders },
      laborPerPersonPiastres: o.labor, packagingPiastres: o.packaging_piastres,
      chefIngredientsOffered: o.chef_ingredients_per_serving_piastres !== null, supplierSourcingAllowed: o.supplier_sourcing_allowed,
      leadTimeMinutes: o.lead_time_minutes,
      servingRules: { minServings: o.min_servings, maxServings: o.max_servings, servingStep: o.serving_step },
      portion: o.portion_weight_grams ? { grams: o.portion_weight_grams, basis: o.portion_weight_basis } : null,
      safetyInstructions: L(o.safety_instructions_en, o.safety_instructions_ar),
      recipeVersion: o.recipe_version,
      ingredients,
      siblingVariants: siblings.rows.map((s) => ({ offerId: s.id, serviceMode: s.service_mode })),
      cuisines: cuisines.get(o.dish_id) ?? [],
      illustrative: o.illustrative,
    });
  });

  // C19 groundwork: supplier categories first, no cuisine step (doc 01 §1.4).
  const GROCERY_FROM = `
    FROM supplier_products p
    JOIN supplier_branches b ON b.id = p.branch_id AND b.status = 'APPROVED' AND b.is_open
    JOIN supplier_organizations o ON o.id = b.organization_id AND o.status = 'APPROVED'
    JOIN inventory_balances ib ON ib.product_id = p.id AND ib.on_hand_packs - ib.reserved_packs >= p.minimum_order_packs
    JOIN ingredients i ON i.id = p.ingredient_id
    WHERE p.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM supplier_branch_service_areas sa WHERE sa.branch_id = b.id AND sa.area_id = $1)`;

  app.get('/v1/groceries/categories', async (req) => {
    const q = z.object({ area: z.string().uuid() }).parse(req.query);
    const area = await loadArea(pool, q.area);
    if (!serviceable(area)) return C.GroceryCategoryList.parse({ serviceability: 'UNSUPPORTED_AREA', items: [] });
    const r = await pool.query(
      `SELECT f.id, f.slug, f.label_en, f.label_ar, count(p.id)::int AS product_count
       FROM facets f LEFT JOIN LATERAL (SELECT p.id ${GROCERY_FROM} AND p.category_facet_id = f.id) p ON true
       WHERE f.facet_type = 'SUPPLIER_CATEGORY' GROUP BY f.id ORDER BY f.sort_order, f.slug`,
      [q.area],
    );
    return C.GroceryCategoryList.parse({
      serviceability: 'SERVICEABLE',
      items: r.rows.map((c) => ({ facetId: c.id, slug: c.slug, label: L(c.label_en, c.label_ar), productCount: c.product_count })),
    });
  });

  app.get('/v1/groceries/products', async (req) => {
    const q = z.object({ area: z.string().uuid(), category: z.string().regex(/^[a-z0-9-]{2,64}$/) }).parse(req.query);
    const area = await loadArea(pool, q.area);
    if (!serviceable(area)) return C.GroceryProductList.parse({ serviceability: 'UNSUPPORTED_AREA', items: [] });
    const r = await pool.query(
      `SELECT p.id, i.name_en, i.name_ar, p.brand, p.pack_quantity, p.pack_unit, p.price_piastres, p.variable_weight,
              b.id AS branch_id, b.public_name, (p.is_illustrative OR b.is_illustrative) AS illustrative
       ${GROCERY_FROM} AND p.category_facet_id = (SELECT id FROM facets WHERE facet_type = 'SUPPLIER_CATEGORY' AND slug = $2)
       ORDER BY i.name_en, p.price_piastres, p.id LIMIT 100`,
      [q.area, q.category],
    );
    return C.GroceryProductList.parse({
      serviceability: 'SERVICEABLE',
      items: r.rows.map((p) => ({
        productId: p.id, ingredient: L(p.name_en, p.name_ar), brand: p.brand, packQuantity: p.pack_quantity, packUnit: p.pack_unit,
        pricePiastres: p.price_piastres, variableWeight: p.variable_weight, shop: { branchId: p.branch_id, publicName: p.public_name }, illustrative: p.illustrative,
      })),
    });
  });

  // C02: recipes browse without location.
  const RECIPE_FROM = `
    FROM recipe_versions rv JOIN dishes d ON d.id = rv.dish_id AND d.publication_state = 'PUBLISHED'
    JOIN chefs c ON c.id = d.chef_id
    WHERE rv.is_public_recipe AND rv.published_at IS NOT NULL AND ${ELIGIBLE_CHEF}`;

  app.get('/v1/learn/recipes', async () => {
    const r = await pool.query(
      `SELECT * FROM (SELECT DISTINCT ON (d.id) rv.id, d.title_en, d.title_ar, c.public_name, c.is_illustrative ${RECIPE_FROM}
       ORDER BY d.id, rv.version DESC) x ORDER BY lower(title_en) LIMIT 100`,
    );
    return C.RecipeList.parse({ items: r.rows.map((x) => ({ recipeId: x.id, title: L(x.title_en, x.title_ar), chefName: x.public_name, illustrative: x.is_illustrative })) });
  });

  app.get('/v1/learn/recipes/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const r = await pool.query(`SELECT rv.id, rv.version, rv.steps, rv.equipment, d.title_en, d.title_ar, c.public_name, c.is_illustrative ${RECIPE_FROM} AND rv.id = $1`, [id]);
    const x = r.rows[0];
    if (!x) throw notFound('Recipe');
    return C.RecipeDetail.parse({
      recipeId: x.id, title: L(x.title_en, x.title_ar), chefName: x.public_name, version: x.version,
      steps: x.steps, equipment: x.equipment, ingredients: await loadIngredients(pool, x.id), illustrative: x.is_illustrative,
    });
  });
}

async function loadIngredients(db: Queryable, recipeVersionId: string): Promise<C.IngredientLine[]> {
  const r = await db.query(
    `SELECT i.id, i.name_en, i.name_ar, ir.quantity_per_serving, ir.unit, ir.weight_basis, ir.is_pantry, ir.allowed_omission,
            i.allergens, i.allergen_data_status
     FROM ingredient_requirements ir JOIN ingredients i ON i.id = ir.ingredient_id
     WHERE ir.recipe_version_id = $1 ORDER BY ir.sort_order, i.slug`,
    [recipeVersionId],
  );
  return r.rows.map((i) => ({
    ingredientId: i.id, name: L(i.name_en, i.name_ar), quantityPerServing: i.quantity_per_serving, unit: i.unit, weightBasis: i.weight_basis,
    isPantry: i.is_pantry, allowedOmission: i.allowed_omission, allergens: i.allergens, allergenDataStatus: i.allergen_data_status,
  }));
}
