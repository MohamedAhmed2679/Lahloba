import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { DISH_FACET_TYPES, canManageChef, publishBlockers, validateServingRules } from '@lahloba/domain';
import type { ResolvedActor, RouteContext } from '../app';
import type { DbClient, Queryable } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { audit, enqueueEvent } from '../platform';
import { runMutation } from './mutation';

const ChefParams = z.object({ chefId: z.string().uuid() });
const L = (en: string, ar: string) => ({ en, ar });

/**
 * Chef menu management (H02, H03). Every route checks a CHEF-scoped membership for :chefId.
 * Callers without access get 404 (no existence leak). Drafting is allowed while the chef is
 * PENDING; publishing requires an APPROVED chef and membership (also enforced by a DB trigger).
 */
function assertChef(actor: ResolvedActor, chefId: string, allowPending = true) {
  if (!canManageChef(actor, chefId, { allowPending })) throw notFound('Chef');
}

async function dishOwned(db: Queryable, chefId: string, dishId: string, lock = false) {
  const r = await db.query(`SELECT id, version, publication_state, title_en, title_ar FROM dishes WHERE id = $1 AND chef_id = $2 ${lock ? 'FOR UPDATE' : ''}`, [dishId, chefId]);
  const d = r.rows[0];
  if (!d) throw notFound('Dish');
  return d as { id: string; version: number; publication_state: string; title_en: string; title_ar: string };
}

async function loadDishDto(db: Queryable, dishId: string): Promise<C.ChefDishDto> {
  const d = (await db.query(`SELECT id, title_en, title_ar, publication_state, version FROM dishes WHERE id = $1`, [dishId])).rows[0];
  const v = await db.query(`SELECT id, service_mode, labor_per_person_piastres, price_version, version, status FROM offer_variants WHERE dish_id = $1 ORDER BY created_at`, [dishId]);
  const rv = await db.query(`SELECT id, version, published_at FROM recipe_versions WHERE dish_id = $1 ORDER BY version`, [dishId]);
  return C.ChefDishDto.parse({
    id: d.id, title: L(d.title_en, d.title_ar), publicationState: d.publication_state, version: d.version,
    variants: v.rows.map((x) => ({ id: x.id, serviceMode: x.service_mode, laborPerPersonPiastres: x.labor_per_person_piastres, priceVersion: x.price_version, version: x.version, status: x.status })),
    recipeVersions: rv.rows.map((x) => ({ id: x.id, version: x.version, published: x.published_at !== null })),
  });
}

async function assertFacets(db: Queryable, facetIds: string[]) {
  const ids = [...new Set(facetIds)];
  if (!ids.length) return [] as Array<{ id: string; facet_type: string }>;
  const r = await db.query<{ id: string; facet_type: string }>(`SELECT id, facet_type FROM facets WHERE id = ANY($1)`, [ids]);
  if (r.rowCount !== ids.length || r.rows.some((f) => !(DISH_FACET_TYPES as readonly string[]).includes(f.facet_type))) {
    throw new HttpError(422, 'INVALID_FACET', 'Dishes accept only cuisine, dish type, course and diet facets');
  }
  return r.rows;
}

export function registerChefRoutes(app: FastifyInstance, ctx: RouteContext) {
  const actorFor = async (req: FastifyRequest, chefId: string) => {
    const actor = await ctx.requireActor(req);
    assertChef(actor, chefId);
    return actor;
  };

  app.get('/v1/chef/:chefId/dishes', async (req) => {
    const { chefId } = ChefParams.parse(req.params);
    await actorFor(req, chefId);
    const ids = await ctx.pool.query(`SELECT id FROM dishes WHERE chef_id = $1 ORDER BY created_at`, [chefId]);
    return C.ChefDishList.parse({ items: await Promise.all(ids.rows.map((r) => loadDishDto(ctx.pool, r.id))) });
  });

  app.post('/v1/chef/:chefId/dishes', async (req, reply) => {
    const { chefId } = ChefParams.parse(req.params);
    await actorFor(req, chefId);
    const body = C.CreateDishRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/dishes', params: { chefId }, body, status: 201 }, async (db, actor) => {
      const facets = await assertFacets(db, body.facetIds);
      const d = await db.query<{ id: string }>(
        `INSERT INTO dishes (chef_id, title_en, title_ar, description_en, description_ar) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [chefId, body.titleEn, body.titleAr, body.descriptionEn, body.descriptionAr],
      );
      const dishId = d.rows[0]!.id;
      for (const f of facets) await db.query(`INSERT INTO dish_facets (dish_id, facet_id, facet_type) VALUES ($1, $2, $3)`, [dishId, f.id, f.facet_type]);
      await audit(db, { actorUserId: actor.userId, action: 'DISH_DRAFT_CREATED', targetType: 'dish', targetId: dishId, correlationId: req.id });
      return loadDishDto(db, dishId);
    });
  });

  app.post('/v1/chef/:chefId/dishes/:dishId/recipe-versions', async (req, reply) => {
    const { chefId, dishId } = ChefParams.extend({ dishId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    const body = C.CreateRecipeVersionRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/dishes/:dishId/recipe-versions', params: { chefId, dishId }, body, status: 201 }, async (db, actor) => {
      await dishOwned(db, chefId, dishId, true);
      const ingIds = [...new Set(body.requirements.map((r) => r.ingredientId))];
      if (ingIds.length !== body.requirements.length) throw new HttpError(422, 'DUPLICATE_INGREDIENT', 'Each ingredient may appear once per recipe version');
      const ings = await db.query<{ id: string; canonical_unit: string }>(`SELECT id, canonical_unit FROM ingredients WHERE id = ANY($1)`, [ingIds]);
      if (ings.rowCount !== ingIds.length) throw new HttpError(422, 'UNKNOWN_INGREDIENT', 'One or more ingredients do not exist');
      const units = new Map(ings.rows.map((i) => [i.id, i.canonical_unit]));
      for (const r of body.requirements) {
        if (units.get(r.ingredientId) !== r.unit) throw new HttpError(422, 'UNIT_MISMATCH', 'Quantity unit must match the ingredient canonical unit (no silent ml/g conversion)');
      }
      const next = await db.query<{ v: number }>(`SELECT COALESCE(max(version), 0) + 1 AS v FROM recipe_versions WHERE dish_id = $1`, [dishId]);
      const version = next.rows[0]!.v;
      const hash = createHash('sha256').update(JSON.stringify({ steps: body.steps, equipment: body.equipment, requirements: body.requirements })).digest('hex');
      const rv = await db.query<{ id: string }>(
        `INSERT INTO recipe_versions (dish_id, version, steps, equipment, is_public_recipe, content_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [dishId, version, JSON.stringify(body.steps), JSON.stringify(body.equipment), body.isPublicRecipe, hash],
      );
      const rvId = rv.rows[0]!.id;
      let order = 0;
      for (const r of body.requirements) {
        await db.query(
          `INSERT INTO ingredient_requirements (recipe_version_id, ingredient_id, quantity_per_serving, unit, weight_basis, is_pantry, allowed_omission, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [rvId, r.ingredientId, r.quantityPerServing, r.unit, r.weightBasis, r.isPantry, r.allowedOmission, order++],
        );
      }
      await audit(db, { actorUserId: actor.userId, action: 'RECIPE_VERSION_CREATED', targetType: 'recipe_version', targetId: rvId, metadata: { dishId, version }, correlationId: req.id });
      return loadDishDto(db, dishId);
    });
  });

  // Publishing a recipe version freezes it and its BOM (DB trigger enforces immutability).
  app.post('/v1/chef/:chefId/recipe-versions/:recipeVersionId/publish', async (req, reply) => {
    const { chefId, recipeVersionId } = ChefParams.extend({ recipeVersionId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/recipe-versions/:id/publish', params: { chefId, recipeVersionId } }, async (db, actor) => {
      const r = await db.query(
        `SELECT rv.id, rv.dish_id, rv.published_at FROM recipe_versions rv JOIN dishes d ON d.id = rv.dish_id WHERE rv.id = $1 AND d.chef_id = $2 FOR UPDATE OF rv`,
        [recipeVersionId, chefId],
      );
      const rv = r.rows[0];
      if (!rv) throw notFound('Recipe version');
      if (rv.published_at) throw conflict('ALREADY_PUBLISHED', 'This recipe version is already published and immutable');
      await db.query(`UPDATE recipe_versions SET published_at = now() WHERE id = $1`, [recipeVersionId]);
      await audit(db, { actorUserId: actor.userId, action: 'RECIPE_VERSION_PUBLISHED', targetType: 'recipe_version', targetId: recipeVersionId, correlationId: req.id });
      return loadDishDto(db, rv.dish_id);
    });
  });

  app.post('/v1/chef/:chefId/dishes/:dishId/variants', async (req, reply) => {
    const { chefId, dishId } = ChefParams.extend({ dishId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    const body = C.CreateVariantRequest.parse(req.body);
    validateServingRules(body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/dishes/:dishId/variants', params: { chefId, dishId }, body, status: 201 }, async (db, actor) => {
      await dishOwned(db, chefId, dishId, true);
      const rv = await db.query(`SELECT 1 FROM recipe_versions WHERE id = $1 AND dish_id = $2`, [body.recipeVersionId, dishId]);
      if (!rv.rowCount) throw new HttpError(422, 'RECIPE_VERSION_MISMATCH', 'Recipe version does not belong to this dish');
      const v = await db.query<{ id: string }>(
        `INSERT INTO offer_variants (dish_id, recipe_version_id, service_mode, labor_per_person_piastres, packaging_piastres,
           chef_ingredients_per_serving_piastres, supplier_sourcing_allowed, lead_time_minutes, min_servings, max_servings, serving_step,
           portion_weight_grams, portion_weight_basis, safety_instructions_en, safety_instructions_ar)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [dishId, body.recipeVersionId, body.serviceMode, body.laborPerPersonPiastres, body.packagingPiastres, body.chefIngredientsPerServingPiastres,
          body.supplierSourcingAllowed, body.leadTimeMinutes, body.minServings, body.maxServings, body.servingStep,
          body.portionWeightGrams, body.portionWeightBasis, body.safetyInstructionsEn, body.safetyInstructionsAr],
      );
      await audit(db, { actorUserId: actor.userId, action: 'OFFER_VARIANT_CREATED', targetType: 'offer_variant', targetId: v.rows[0]!.id, metadata: { dishId, serviceMode: body.serviceMode }, correlationId: req.id });
      return loadDishDto(db, dishId);
    });
  });

  // H02: price edits bump price_version; the previous price is kept in history (DB trigger).
  app.patch('/v1/chef/:chefId/variants/:variantId/pricing', async (req, reply) => {
    const { chefId, variantId } = ChefParams.extend({ variantId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    const body = C.UpdateVariantPricingRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'PATCH /v1/chef/:chefId/variants/:id/pricing', params: { chefId, variantId }, body }, async (db, actor) => {
      const r = await db.query(
        `SELECT ov.id, ov.dish_id, ov.version, ov.supplier_sourcing_allowed FROM offer_variants ov JOIN dishes d ON d.id = ov.dish_id
         WHERE ov.id = $1 AND d.chef_id = $2 FOR UPDATE OF ov`,
        [variantId, chefId],
      );
      const v = r.rows[0];
      if (!v) throw notFound('Variant');
      if (v.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'Variant changed; reload before editing', { currentVersion: v.version });
      if (body.chefIngredientsPerServingPiastres === null && !v.supplier_sourcing_allowed) {
        throw new HttpError(422, 'NO_SOURCING_STRATEGY', 'At least one sourcing strategy is required');
      }
      await db.query(
        `UPDATE offer_variants SET labor_per_person_piastres = $2, packaging_piastres = $3, chef_ingredients_per_serving_piastres = $4,
           price_version = price_version + 1, version = version + 1, updated_at = now() WHERE id = $1`,
        [variantId, body.laborPerPersonPiastres, body.packagingPiastres, body.chefIngredientsPerServingPiastres],
      );
      await audit(db, { actorUserId: actor.userId, action: 'OFFER_VARIANT_PRICE_CHANGED', targetType: 'offer_variant', targetId: variantId, correlationId: req.id });
      return loadDishDto(db, v.dish_id);
    });
  });

  // H03: publish into live discovery only when every gate passes.
  app.post('/v1/chef/:chefId/dishes/:dishId/publish', async (req, reply) => {
    const { chefId, dishId } = ChefParams.extend({ dishId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    const body = C.ExpectedVersion.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/dishes/:dishId/publish', params: { chefId, dishId }, body }, async (db, actor) => {
      const dish = await dishOwned(db, chefId, dishId, true);
      if (dish.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'Dish changed; reload before publishing', { currentVersion: dish.version });
      const blockers = await computeBlockers(db, actor, chefId, dish);
      if (blockers.length) throw new HttpError(422, 'PUBLISH_BLOCKED', 'Dish is not ready to publish', { blockers });
      await db.query(`UPDATE dishes SET publication_state = 'PUBLISHED', published_at = now(), version = version + 1, updated_at = now() WHERE id = $1`, [dishId]);
      await audit(db, { actorUserId: actor.userId, action: 'DISH_PUBLISHED', targetType: 'dish', targetId: dishId, correlationId: req.id });
      await enqueueEvent(db, { aggregateType: 'dish', aggregateId: dishId, eventType: 'DishPublished', payload: { dishId, chefId }, correlationId: req.id });
      return loadDishDto(db, dishId);
    });
  });

  // H04: capacity slots in work units. Overlaps are refused by the database (exclusion constraint).
  const SlotBody = z.object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    totalWorkUnits: z.number().int().min(1).max(10000),
  }).strict();
  const slotDto = (r: Record<string, any>) => ({
    id: r.id, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(),
    totalWorkUnits: r.total_work_units, reservedWorkUnits: r.reserved_work_units, status: r.status, version: r.version,
  });

  app.get('/v1/chef/:chefId/capacity-slots', async (req) => {
    const { chefId } = ChefParams.parse(req.params);
    await actorFor(req, chefId);
    const r = await ctx.pool.query(
      `SELECT * FROM chef_capacity_slots WHERE chef_id = $1 AND ends_at > now() - interval '1 day' AND status = 'ACTIVE' ORDER BY starts_at LIMIT 200`, [chefId]);
    return { items: r.rows.map(slotDto) };
  });

  app.post('/v1/chef/:chefId/capacity-slots', async (req, reply) => {
    const { chefId } = ChefParams.parse(req.params);
    await actorFor(req, chefId);
    const body = SlotBody.parse(req.body);
    if (new Date(body.startsAt).getTime() < Date.now()) throw new HttpError(422, 'SLOT_IN_PAST', 'Slots must start in the future');
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/capacity-slots', params: { chefId }, body, status: 201 }, async (db, actor) => {
      try {
        await db.query('SAVEPOINT slot');
        const r = await db.query(
          `INSERT INTO chef_capacity_slots (chef_id, starts_at, ends_at, total_work_units) VALUES ($1, $2, $3, $4) RETURNING *`,
          [chefId, body.startsAt, body.endsAt, body.totalWorkUnits],
        );
        await audit(db, { actorUserId: actor.userId, action: 'CAPACITY_SLOT_CREATED', targetType: 'chef_capacity_slot', targetId: r.rows[0].id, correlationId: req.id });
        return slotDto(r.rows[0]);
      } catch (e) {
        if ((e as { code?: string }).code === '23P01') {
          await db.query('ROLLBACK TO SAVEPOINT slot');
          throw conflict('SLOT_OVERLAP', 'This slot overlaps another active slot');
        }
        throw e;
      }
    });
  });

  app.post('/v1/chef/:chefId/capacity-slots/:slotId/cancel', async (req, reply) => {
    const { chefId, slotId } = ChefParams.extend({ slotId: z.string().uuid() }).parse(req.params);
    await actorFor(req, chefId);
    const body = C.ExpectedVersion.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/capacity-slots/:id/cancel', params: { chefId, slotId }, body }, async (db, actor) => {
      const r = await db.query(`SELECT * FROM chef_capacity_slots WHERE id = $1 AND chef_id = $2 FOR UPDATE`, [slotId, chefId]);
      const slot = r.rows[0];
      if (!slot) throw notFound('Slot');
      if (slot.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'Slot changed; reload', { currentVersion: slot.version });
      // Existing bookings need an operations decision; they are never silently deleted (H12).
      if (slot.reserved_work_units > 0) throw conflict('SLOT_HAS_BOOKINGS', 'This slot has bookings; contact operations to move them');
      const u = await db.query(`UPDATE chef_capacity_slots SET status = 'CANCELLED', version = version + 1 WHERE id = $1 RETURNING *`, [slotId]);
      await audit(db, { actorUserId: actor.userId, action: 'CAPACITY_SLOT_CANCELLED', targetType: 'chef_capacity_slot', targetId: slotId, correlationId: req.id });
      return slotDto(u.rows[0]);
    });
  });

  // H12 groundwork: pause/resume new orders. Existing commitments arrive with orders (Slice 2+).
  app.post('/v1/chef/:chefId/availability', async (req, reply) => {
    const { chefId } = ChefParams.parse(req.params);
    const actor0 = await ctx.requireActor(req);
    assertChef(actor0, chefId, false);
    const body = z.object({ acceptingOrders: z.boolean(), expectedVersion: z.number().int().positive() }).strict().parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/chef/:chefId/availability', params: { chefId }, body }, async (db, actor) => {
      const r = await db.query(`SELECT status, version FROM chefs WHERE id = $1 FOR UPDATE`, [chefId]);
      const c = r.rows[0];
      if (!c) throw notFound('Chef');
      if (c.version !== body.expectedVersion) throw conflict('VERSION_CONFLICT', 'Chef profile changed; reload', { currentVersion: c.version });
      if (body.acceptingOrders && c.status !== 'APPROVED') throw new HttpError(422, 'CHEF_NOT_APPROVED', 'Only approved chefs can accept orders');
      await db.query(`UPDATE chefs SET accepting_orders = $2, version = version + 1, updated_at = now() WHERE id = $1`, [chefId, body.acceptingOrders]);
      await audit(db, { actorUserId: actor.userId, action: body.acceptingOrders ? 'KITCHEN_RESUMED' : 'KITCHEN_PAUSED', targetType: 'chef', targetId: chefId, correlationId: req.id });
      return { chefId, acceptingOrders: body.acceptingOrders, version: c.version + 1 };
    });
  });
}

async function computeBlockers(db: DbClient, actor: ResolvedActor, chefId: string, dish: { id: string; title_en: string; title_ar: string }) {
  const chef = (await db.query(`SELECT status FROM chefs WHERE id = $1`, [chefId])).rows[0];
  const cuisines = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM dish_facets WHERE dish_id = $1 AND facet_type = 'CUISINE'`, [dish.id]);
  const variants = await db.query(
    `SELECT ov.status, ov.service_mode, ov.safety_instructions_en, ov.safety_instructions_ar, ov.chef_ingredients_per_serving_piastres,
            ov.supplier_sourcing_allowed, rv.published_at,
            (SELECT count(*)::int FROM ingredient_requirements ir WHERE ir.recipe_version_id = rv.id) AS req_count
     FROM offer_variants ov JOIN recipe_versions rv ON rv.id = ov.recipe_version_id WHERE ov.dish_id = $1`,
    [dish.id],
  );
  return publishBlockers({
    chefStatus: chef.status,
    membershipApproved: canManageChef(actor, chefId, { allowPending: false }),
    titleEn: dish.title_en, titleAr: dish.title_ar, cuisineFacetCount: cuisines.rows[0]!.n,
    variants: variants.rows.map((v) => ({
      status: v.status, serviceMode: v.service_mode, recipePublished: v.published_at !== null, requirementCount: v.req_count,
      safetyInstructionsEn: v.safety_instructions_en, safetyInstructionsAr: v.safety_instructions_ar,
      chefIngredientsOffered: v.chef_ingredients_per_serving_piastres !== null, supplierSourcingAllowed: v.supplier_sourcing_allowed,
    })),
  });
}
