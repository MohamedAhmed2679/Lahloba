import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { laborTotal } from '@lahloba/domain';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

describe.skipIf(!TEST_DB_ADMIN_URL)('public catalog (C01-C05)', () => {
  let ctx: TestContext;
  let area: Record<string, string>;
  beforeAll(async () => {
    ctx = await createTestContext();
    area = ctx.seed!.area;
  });
  afterAll(async () => ctx?.close());

  it('C01: lists manually selectable areas, including coming-soon ones, without login', async () => {
    const r = await call(ctx, 'GET', '/v1/areas');
    expect(r.status).toBe(200);
    const slugs = r.body.items.map((a: any) => a.slug);
    expect(slugs).toEqual(expect.arrayContaining(['maadi', 'zamalek']));
    expect(r.body.items.find((a: any) => a.slug === 'zamalek').physicalOrderingEnabled).toBe(false);
  });

  it('C04: returns only eligible offers (excludes closed kitchen, drafts, other modes)', async () => {
    const r = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW`);
    expect(r.status).toBe(200);
    expect(r.body.serviceability).toBe('SERVICEABLE');
    const titles = r.body.items.map((i: any) => i.title.en).sort();
    expect(titles).toEqual(['Koshari', 'Molokhia with chicken', 'Pasta in tomato sauce']);
    expect(titles).not.toContain('Shish tawook'); // chef B not accepting orders
    expect(titles.join()).not.toContain('draft');
  });

  it('C04: chef must serve the selected area', async () => {
    const r = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.heliopolis}&mode=EAT_NOW`);
    expect(r.body.items).toEqual([]);
  });

  it('C01: unsupported area cannot proceed (no offers, explicit status)', async () => {
    const r = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.zamalek}&mode=EAT_NOW`);
    expect(r.status).toBe(200);
    expect(r.body.serviceability).toBe('UNSUPPORTED_AREA');
    expect(r.body.items).toEqual([]);
  });

  it('unknown area is 404, malformed input is 400 without echoing values', async () => {
    expect((await call(ctx, 'GET', `/v1/catalog/offers?area=6f1c2a51-6f1c-4a51-8f1c-6f1c2a516f1c&mode=EAT_NOW`)).status).toBe(404);
    const bad = await call(ctx, 'GET', `/v1/catalog/offers?area=<script>&mode=EAT_NOW`);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect(bad.raw).not.toContain('<script>');
    expect(bad.body.error.correlationId).toBeTruthy();
  });

  it('C03: cuisine and dish type filter independently, with counts reflecting eligible results', async () => {
    const all = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW`);
    const counts = Object.fromEntries(all.body.facetCounts.cuisine.map((c: any) => [c.slug, c.count]));
    expect(counts).toEqual({ egyptian: 2, italian: 1 });
    const egyptian = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&cuisine=egyptian`);
    expect(egyptian.body.items.map((i: any) => i.title.en).sort()).toEqual(['Koshari', 'Molokhia with chicken']);
    // Dish type counts honour the cuisine selection; cuisine counts ignore their own selection.
    expect(egyptian.body.facetCounts.cuisine.find((c: any) => c.slug === 'italian').count).toBe(1);
    const pasta = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&dishType=pasta`);
    expect(pasta.body.items.map((i: any) => i.title.en)).toEqual(['Pasta in tomato sauce']);
    const none = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&cuisine=italian&dishType=stews`);
    expect(none.body.items).toEqual([]);
  });

  it('C03: broad collections expand to precise cuisines; unknown slugs match nothing', async () => {
    const arabic = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&cuisine=arabic`);
    expect(arabic.body.items).toHaveLength(2);
    const unknown = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&cuisine=pet-shop`);
    expect(unknown.body.items).toEqual([]);
  });

  it('paginates with an opaque cursor and no duplicates', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const q: string = cursor ? `&cursor=${cursor}` : '';
      const r = await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&limit=1${q}`);
      seen.push(...r.body.items.map((i: any) => i.offerId));
      cursor = r.body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
    expect((await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW&cursor=garbage`)).status).toBe(400);
  });

  it('C05/C06/C07: offer detail shows variant-specific data and ingredient transparency', async () => {
    const r = await call(ctx, 'GET', `/v1/offers/${ctx.seed!.offers['molokhia-eat']}`);
    expect(r.status).toBe(200);
    const o = r.body;
    expect(o.laborPerPersonPiastres).toBe(1000);
    expect(laborTotal(o.laborPerPersonPiastres, 4)).toBe(4000); // founder example: 10 EGP x 4 = 40 EGP
    expect(o.servingRules).toEqual({ minServings: 2, maxServings: 8, servingStep: 1 });
    expect(o.portion).toEqual({ grams: 450, basis: 'COOKED_NET' });
    expect(o.siblingVariants.map((v: any) => v.serviceMode).sort()).toEqual(['COOK_AT_HOME', 'HEAT_AT_HOME']);
    const chicken = o.ingredients.find((i: any) => i.name.en.startsWith('Chicken'));
    expect(chicken).toMatchObject({ quantityPerServing: 150, unit: 'g', weightBasis: 'RAW_EDIBLE' });
    expect(o.ingredients.find((i: any) => i.name.en === 'Ghee')).toMatchObject({ isPantry: true, allergens: ['milk'], allergenDataStatus: 'DECLARED' });
    const heat = await call(ctx, 'GET', `/v1/offers/${ctx.seed!.offers['molokhia-heat']}`);
    expect(heat.body.safetyInstructions.en).toMatch(/reheat/);
    expect(heat.body.safetyInstructions.en).not.toBe(o.safetyInstructions.en);
  });

  it('C07: unknown allergen data is reported as UNKNOWN', async () => {
    const r = await call(ctx, 'GET', `/v1/offers/${ctx.seed!.offers['koshari-eat']}`);
    expect(r.body.ingredients.find((i: any) => i.name.en === 'Vegetable oil').allergenDataStatus).toBe('UNKNOWN');
  });

  it('C05: unpublished variants are not orderable or viewable', async () => {
    expect((await call(ctx, 'GET', `/v1/offers/${ctx.seed!.offers['mandi-eat']}`)).status).toBe(404);
  });

  it('chef profile never exposes the private kitchen address or owner identity', async () => {
    const r = await call(ctx, 'GET', `/v1/chefs/${ctx.seed!.chefs.A}`);
    expect(r.status).toBe(200);
    expect(r.body.verifiedClaims).toEqual([]);
    expect(r.body.illustrative).toBe(true);
    for (const raw of [r.raw, (await call(ctx, 'GET', `/v1/offers/${ctx.seed!.offers['molokhia-eat']}`)).raw,
      (await call(ctx, 'GET', `/v1/catalog/offers?area=${area.maadi}&mode=EAT_NOW`)).raw]) {
      expect(raw).not.toContain('PRIVATE');
      expect(raw).not.toContain(ctx.seed!.users.chefAOwner);
      expect(raw).not.toMatch(/kitchen_address|address_text|owner_user_id/);
    }
  });

  it('closed kitchen profile is visible but says it is not accepting; suspended chef is 404', async () => {
    const b = await call(ctx, 'GET', `/v1/chefs/${ctx.seed!.chefs.B}`);
    expect(b.body.acceptingOrders).toBe(false);
    await ctx.pool.query(`UPDATE chefs SET status = 'SUSPENDED', accepting_orders = false WHERE id = $1`, [ctx.seed!.chefs.B]);
    expect((await call(ctx, 'GET', `/v1/chefs/${ctx.seed!.chefs.B}`)).status).toBe(404);
    await ctx.pool.query(`UPDATE chefs SET status = 'APPROVED' WHERE id = $1`, [ctx.seed!.chefs.B]);
  });

  it('C02: learning recipes browse without location', async () => {
    const r = await call(ctx, 'GET', '/v1/learn/recipes');
    expect(r.body.items.map((x: any) => x.title.en)).toEqual(['Red lentil soup']);
    const d = await call(ctx, 'GET', `/v1/learn/recipes/${r.body.items[0].recipeId}`);
    expect(d.status).toBe(200);
    expect(d.body.steps.length).toBeGreaterThan(0);
    expect(d.body.ingredients.length).toBe(4);
  });

  it('C02/C19 groundwork: groceries show supplier categories first, hide out-of-stock products', async () => {
    const cats = await call(ctx, 'GET', `/v1/groceries/categories?area=${area.maadi}`);
    const counts = Object.fromEntries(cats.body.items.map((c: any) => [c.slug, c.productCount]));
    // Two illustrative shops serve Maadi; the out-of-stock lentils are not counted.
    expect(counts).toMatchObject({ butcher: 2, pantry: 2, produce: 2, bakery: 1, grocery: 2, dairy: 0 });
    const butcher = await call(ctx, 'GET', `/v1/groceries/products?area=${area.maadi}&category=butcher`);
    expect(butcher.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ packQuantity: 500, packUnit: 'g', pricePiastres: 9000, variableWeight: true })]));
    expect(butcher.raw).not.toContain('PRIVATE');
    const heliopolis = await call(ctx, 'GET', `/v1/groceries/categories?area=${area.heliopolis}`);
    // Only the Nasr City shop delivers to Heliopolis.
    expect(Object.fromEntries(heliopolis.body.items.map((c: any) => [c.slug, c.productCount]))).toMatchObject({ butcher: 1, bakery: 0, produce: 0 });
    const zamalek = await call(ctx, 'GET', `/v1/groceries/products?area=${area.zamalek}&category=butcher`);
    expect(zamalek.body.serviceability).toBe('UNSUPPORTED_AREA');
  });

  it('facets are typed independently and duplicates are normalized to one canonical record', async () => {
    const r = await call(ctx, 'GET', '/v1/facets?type=DISH_TYPE');
    expect(r.body.items.filter((f: any) => f.slug === 'grills')).toHaveLength(1);
    const aliases = await ctx.pool.query(`SELECT count(*)::int AS n FROM facet_aliases a JOIN facets f ON f.id = a.facet_id WHERE f.slug = 'grills' AND a.alias_normalized = 'grills'`);
    expect(aliases.rows[0].n).toBe(1);
    const sup = await call(ctx, 'GET', '/v1/facets?type=SUPPLIER_CATEGORY');
    expect(sup.body.items.map((f: any) => f.slug)).not.toContain('pet-shop');
  });
});
