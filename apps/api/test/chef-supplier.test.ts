import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

describe.skipIf(!TEST_DB_ADMIN_URL)('chef menu and supplier products with cross-role authorization (H02, H03, S02)', () => {
  let ctx: TestContext;
  let chefA: string;
  let chefB: string;
  let supplier: string;
  let customer: string;
  let s: NonNullable<TestContext['seed']>;
  beforeAll(async () => {
    ctx = await createTestContext();
    s = ctx.seed!;
    chefA = await ctx.token('sample-chef-a');
    chefB = await ctx.token('sample-chef-b');
    supplier = await ctx.token('sample-supplier');
    customer = await ctx.token('plain-customer');
  });
  afterAll(async () => ctx?.close());

  const recipe = () => ({
    steps: [{ en: 'Boil lentils.', ar: 'اسلق العدس.' }],
    requirements: [
      { ingredientId: s.ingredient['lentils-red'], quantityPerServing: 70, unit: 'g', weightBasis: 'AS_PURCHASED' },
      { ingredientId: s.ingredient.onion, quantityPerServing: 40, unit: 'g', weightBasis: 'RAW_EDIBLE' },
    ],
  });
  const variant = (recipeVersionId: string) => ({
    serviceMode: 'EAT_NOW', recipeVersionId, laborPerPersonPiastres: 1000, packagingPiastres: 200, chefIngredientsPerServingPiastres: 1500,
    supplierSourcingAllowed: true, leadTimeMinutes: 60, minServings: 1, maxServings: 6, servingStep: 1, portionWeightGrams: 350,
    portionWeightBasis: 'COOKED_NET', safetyInstructionsEn: 'Eat within the stated time.', safetyInstructionsAr: 'يؤكل خلال المدة المذكورة.',
  });

  it('cross-role denial: chefs only see their own kitchen; customers and suppliers see none', async () => {
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/dishes`, { token: chefA })).status).toBe(200);
    for (const tok of [chefB, supplier, customer]) {
      const r = await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/dishes`, { token: tok });
      expect(r.status).toBe(404); // no existence leak
    }
    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes`, { token: chefB, body: { titleEn: 'Hijack', titleAr: 'اختطاف' } })).status).toBe(404);
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.A}/dishes`)).status).toBe(401);
  });

  it('cross-role denial: suppliers only manage their own branch', async () => {
    expect((await call(ctx, 'GET', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier })).status).toBe(200);
    for (const tok of [chefA, customer]) {
      expect((await call(ctx, 'GET', `/v1/supplier/branches/${s.branchId}/products`, { token: tok })).status).toBe(404);
      expect((await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: tok, body: {} })).status).toBe(404);
    }
    expect((await call(ctx, 'GET', '/v1/ops/partner-applications', { token: supplier })).status).toBe(403);
  });

  it('suspending a membership revokes access immediately', async () => {
    await ctx.pool.query(`UPDATE role_memberships SET approval_state = 'SUSPENDED' WHERE scope_id = $1`, [s.chefs.B]);
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.B}/dishes`, { token: chefB })).status).toBe(404);
    await ctx.pool.query(`UPDATE role_memberships SET approval_state = 'APPROVED' WHERE scope_id = $1`, [s.chefs.B]);
    expect((await call(ctx, 'GET', `/v1/chef/${s.chefs.B}/dishes`, { token: chefB })).status).toBe(200);
  });

  it('H03: draft cannot reach discovery; publish is blocked until every gate passes, then appears', async () => {
    const dish = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes`, { token: chefA, body: { titleEn: 'Test lentil bowl', titleAr: 'طبق عدس تجريبي', facetIds: [s.facet['CUISINE:egyptian']] } });
    expect(dish.status).toBe(201);
    const dishId = dish.body.id;
    const blocked = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dishId}/publish`, { token: chefA, body: { expectedVersion: 1 } });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.details.blockers).toContain('NO_ACTIVE_VARIANT');

    const rv = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dishId}/recipe-versions`, { token: chefA, body: recipe() });
    expect(rv.status).toBe(201);
    const rvId = rv.body.recipeVersions[0].id;
    const v = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dishId}/variants`, { token: chefA, body: variant(rvId) });
    expect(v.status).toBe(201);
    const stillBlocked = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dishId}/publish`, { token: chefA, body: { expectedVersion: 1 } });
    expect(stillBlocked.body.error.details.blockers).toEqual(['RECIPE_NOT_PUBLISHED']);

    const search = () => call(ctx, 'GET', `/v1/catalog/offers?area=${s.area.maadi}&mode=EAT_NOW`);
    expect((await search()).body.items.map((i: any) => i.title.en)).not.toContain('Test lentil bowl');

    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/recipe-versions/${rvId}/publish`, { token: chefA })).status).toBe(200);
    const pub = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dishId}/publish`, { token: chefA, body: { expectedVersion: 1 } });
    expect(pub.status).toBe(200);
    expect(pub.body.publicationState).toBe('PUBLISHED');
    expect((await search()).body.items.map((i: any) => i.title.en)).toContain('Test lentil bowl');
  });

  it('H01: a pending (unapproved) chef can draft but cannot publish', async () => {
    const tok = await ctx.token('pending-chef');
    const app = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: {
      kind: 'CHEF', chef: { publicName: 'Pending Kitchen', publicAreaId: s.area.maadi, serviceAreaIds: [s.area.maadi], kitchenAddress: { addressText: 'Pending street 1', areaId: s.area.maadi } } } });
    const chefId = app.body.subjectId;
    const d = await call(ctx, 'POST', `/v1/chef/${chefId}/dishes`, { token: tok, body: { titleEn: 'Pending dish', titleAr: 'طبق معلق', facetIds: [s.facet['CUISINE:egyptian']] } });
    expect(d.status).toBe(201);
    const rv = await call(ctx, 'POST', `/v1/chef/${chefId}/dishes/${d.body.id}/recipe-versions`, { token: tok, body: recipe() });
    await call(ctx, 'POST', `/v1/chef/${chefId}/recipe-versions/${rv.body.recipeVersions[0].id}/publish`, { token: tok });
    await call(ctx, 'POST', `/v1/chef/${chefId}/dishes/${d.body.id}/variants`, { token: tok, body: variant(rv.body.recipeVersions[0].id) });
    const pub = await call(ctx, 'POST', `/v1/chef/${chefId}/dishes/${d.body.id}/publish`, { token: tok, body: { expectedVersion: 1 } });
    expect(pub.status).toBe(422);
    expect(pub.body.error.details.blockers).toEqual(expect.arrayContaining(['CHEF_NOT_APPROVED', 'MEMBERSHIP_NOT_APPROVED']));
    // Defense in depth: the database refuses publication by an unapproved chef.
    await expect(ctx.pool.query(`UPDATE dishes SET publication_state = 'PUBLISHED', published_at = now() WHERE id = $1`, [d.body.id])).rejects.toThrow(/approved chefs/);
    // Pending chef cannot open the kitchen for orders.
    expect((await call(ctx, 'POST', `/v1/chef/${chefId}/availability`, { token: tok, body: { acceptingOrders: true, expectedVersion: 1 } })).status).toBe(404);
  });

  it('recipe validation: unit must match the canonical unit, no duplicate ingredients, dishes reject supplier categories', async () => {
    const dish = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes`, { token: chefA, body: { titleEn: 'Validation dish', titleAr: 'طبق تحقق' } });
    const bad = recipe();
    bad.requirements[0]!.unit = 'ml';
    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dish.body.id}/recipe-versions`, { token: chefA, body: bad })).body.error.code).toBe('UNIT_MISMATCH');
    const dup = recipe();
    dup.requirements[1] = dup.requirements[0]!;
    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dish.body.id}/recipe-versions`, { token: chefA, body: dup })).body.error.code).toBe('DUPLICATE_INGREDIENT');
    const facet = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes`, { token: chefA, body: { titleEn: 'Bad facet', titleAr: 'تصنيف خطأ', facetIds: [s.facet['SUPPLIER_CATEGORY:butcher']] } });
    expect(facet.body.error.code).toBe('INVALID_FACET');
    const fractional = { ...variant('00000000-0000-4000-8000-000000000000'), laborPerPersonPiastres: 10.5 };
    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/dishes/${dish.body.id}/variants`, { token: chefA, body: fractional })).status).toBe(400);
  });

  it('O12: published recipe versions and their ingredients are immutable', async () => {
    const rvId = (await ctx.pool.query(`SELECT recipe_version_id FROM offer_variants WHERE id = $1`, [s.offers['molokhia-eat']])).rows[0].recipe_version_id;
    await expect(ctx.pool.query(`UPDATE recipe_versions SET steps = '[{"en":"x","ar":"x"}]' WHERE id = $1`, [rvId])).rejects.toThrow(/immutable/);
    await expect(ctx.pool.query(`UPDATE ingredient_requirements SET quantity_per_serving = 1 WHERE recipe_version_id = $1`, [rvId])).rejects.toThrow(/immutable/);
    await expect(ctx.pool.query(`DELETE FROM ingredient_requirements WHERE recipe_version_id = $1`, [rvId])).rejects.toThrow(/immutable/);
    expect((await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/recipe-versions/${rvId}/publish`, { token: chefA })).body.error.code).toBe('ALREADY_PUBLISHED');
  });

  it('H02: price edits bump price_version and keep history; stale edits are refused', async () => {
    const id = s.offers['koshari-eat'];
    const r = await call(ctx, 'PATCH', `/v1/chef/${s.chefs.A}/variants/${id}/pricing`, { token: chefA, body: { laborPerPersonPiastres: 900, packagingPiastres: 300, chefIngredientsPerServingPiastres: 3500, expectedVersion: 1 } });
    expect(r.status).toBe(200);
    const v = r.body.variants.find((x: any) => x.id === id);
    expect(v).toMatchObject({ laborPerPersonPiastres: 900, priceVersion: 2, version: 2 });
    const hist = await ctx.pool.query(`SELECT price_version, labor_per_person_piastres FROM offer_variant_price_history WHERE variant_id = $1`, [id]);
    expect(hist.rows).toEqual([{ price_version: 1, labor_per_person_piastres: 800 }]);
    const stale = await call(ctx, 'PATCH', `/v1/chef/${s.chefs.A}/variants/${id}/pricing`, { token: chefA, body: { laborPerPersonPiastres: 100, packagingPiastres: 0, chefIngredientsPerServingPiastres: 0, expectedVersion: 1 } });
    expect(stale.status).toBe(409);
    expect((await call(ctx, 'PATCH', `/v1/chef/${s.chefs.B}/variants/${id}/pricing`, { token: chefB, body: { laborPerPersonPiastres: 1, packagingPiastres: 0, chefIngredientsPerServingPiastres: 0, expectedVersion: 2 } })).status).toBe(404);
    await expect(ctx.pool.query(`UPDATE offer_variants SET labor_per_person_piastres = 1 WHERE id = $1`, [id])).rejects.toThrow(/price_version/);
  });

  it('H12 groundwork: pausing the kitchen removes offers from discovery', async () => {
    const chef = (await ctx.pool.query(`SELECT version FROM chefs WHERE id = $1`, [s.chefs.A])).rows[0];
    const r = await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/availability`, { token: chefA, body: { acceptingOrders: false, expectedVersion: chef.version } });
    expect(r.status).toBe(200);
    expect((await call(ctx, 'GET', `/v1/catalog/offers?area=${s.area.maadi}&mode=EAT_NOW`)).body.items).toEqual([]);
    await call(ctx, 'POST', `/v1/chef/${s.chefs.A}/availability`, { token: chefA, body: { acceptingOrders: true, expectedVersion: chef.version + 1 } });
    expect((await call(ctx, 'GET', `/v1/catalog/offers?area=${s.area.maadi}&mode=EAT_NOW`)).body.items.length).toBeGreaterThan(0);
  });

  it('S02: product publishing validates units, categories, SKU uniqueness and integer prices', async () => {
    const base = { ingredientId: s.ingredient.yogurt, sku: 'TEST-YOG-500', packQuantity: 500, packUnit: 'g', pricePiastres: 2500, variableWeight: false, brand: null, categoryFacetId: s.facet['SUPPLIER_CATEGORY:dairy'], availablePacks: 12 };
    const ok = await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier, body: base });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ priceVersion: 1, availablePacks: 12, packUnit: 'g' });
    expect((await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier, body: base })).body.error.code).toBe('SKU_EXISTS');
    expect((await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier, body: { ...base, sku: 'TEST-2', packUnit: 'ml' } })).body.error.code).toBe('UNIT_MISMATCH');
    expect((await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier, body: { ...base, sku: 'TEST-3', categoryFacetId: s.facet['CUISINE:egyptian'] } })).body.error.code).toBe('INVALID_FACET');
    expect((await call(ctx, 'POST', `/v1/supplier/branches/${s.branchId}/products`, { token: supplier, body: { ...base, sku: 'TEST-4', pricePiastres: 25.5 } })).status).toBe(400);
    const dairy = await call(ctx, 'GET', `/v1/groceries/products?area=${s.area.maadi}&category=dairy`);
    expect(dairy.body.items.map((p: any) => p.ingredient.en)).toEqual(['Plain yogurt']);
  });
});
