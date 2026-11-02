import { describe, expect, it } from 'vitest';
import { ApiError, CreatePartnerApplication, CreateVariantRequest, NetworkError, PublicChef, createApiClient } from './index';

const id = '0b6f3c1e-8f0a-4c3b-9a51-3f7d2c1e9a10';

describe('contracts', () => {
  it('public chef parsing strips private fields that a query might select', () => {
    const parsed = PublicChef.parse({
      id, publicName: 'Sample Kitchen', bio: { en: '', ar: '' }, area: { en: 'Area', ar: 'منطقة' },
      acceptingOrders: true, verifiedClaims: [], illustrative: true, offers: [],
      kitchenAddress: '12 Private St', ownerUserId: id, evidenceObjectKey: 'secret/key',
    });
    expect(JSON.stringify(parsed)).not.toMatch(/Private St|secret\/key|ownerUserId/);
  });

  it('public chef cannot carry verification claims in Slice 1', () => {
    expect(() => PublicChef.parse({
      id, publicName: 'x', bio: { en: '', ar: '' }, area: { en: '', ar: '' }, acceptingOrders: true,
      verifiedClaims: ['FOOD_SAFETY'], illustrative: false, offers: [],
    })).toThrow();
  });

  it('partner application rejects client-supplied roles or status', () => {
    const r = CreatePartnerApplication.safeParse({
      kind: 'COURIER', courier: { displayName: 'Rider', equipment: ['BICYCLE'] }, status: 'APPROVED',
    });
    expect(r.success).toBe(false);
  });

  it('variant requires a sourcing strategy and coherent servings', () => {
    const base = {
      serviceMode: 'EAT_NOW', recipeVersionId: id, laborPerPersonPiastres: 1000, packagingPiastres: 0,
      chefIngredientsPerServingPiastres: null, supplierSourcingAllowed: false, leadTimeMinutes: 60,
      minServings: 2, maxServings: 1, servingStep: 1, portionWeightGrams: null, portionWeightBasis: null,
      safetyInstructionsEn: 'x', safetyInstructionsAr: 'x',
    };
    const r = CreateVariantRequest.safeParse(base);
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['maxServings', 'supplierSourcingAllowed']));
    expect(CreateVariantRequest.safeParse({ ...base, maxServings: 8, supplierSourcingAllowed: true }).success).toBe(true);
    expect(CreateVariantRequest.safeParse({ ...base, maxServings: 8, supplierSourcingAllowed: true, laborPerPersonPiastres: 10.5 }).success).toBe(false);
  });
});

describe('api client', () => {
  it('maps error envelopes to ApiError and sends idempotency keys on mutations', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const client = createApiClient({
      baseUrl: 'http://api.test/',
      newIdempotencyKey: () => 'key-1',
      getToken: () => 'tok',
      fetch: async (url, init) => {
        calls.push({ url, headers: init?.headers ?? {} });
        return {
          ok: false, status: 403, headers: { get: () => null },
          json: async () => ({ error: { code: 'FORBIDDEN', message: 'no', correlationId: 'c1' } }),
        };
      },
    });
    await expect(client.applyAsPartner({ kind: 'COURIER', courier: { displayName: 'R', equipment: ['BICYCLE'] } }))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, correlationId: 'c1' });
    expect(calls[0]!.url).toBe('http://api.test/v1/partner-applications');
    expect(calls[0]!.headers['idempotency-key']).toBe('key-1');
    expect(calls[0]!.headers.authorization).toBe('Bearer tok');
  });

  it('reports network failure distinctly from an API error', async () => {
    const client = createApiClient({ baseUrl: 'http://api.test', fetch: async () => { throw new TypeError('offline'); } });
    const err = await client.areas().catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).not.toBeInstanceOf(ApiError);
  });

  it('encodes repeated filter params', async () => {
    let seen = '';
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (url) => {
        seen = url;
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ serviceability: 'SERVICEABLE', items: [], facetCounts: { cuisine: [], dishType: [] }, nextCursor: null }) };
      },
    });
    await client.searchOffers({ area: id, mode: 'EAT_NOW', cuisine: ['egyptian', 'levantine'] });
    expect(seen).toContain('cuisine=egyptian&cuisine=levantine');
  });
});
