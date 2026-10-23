import type { z } from 'zod';
import * as S from './schemas';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, correlationId: string | null, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
  }
}

/** Network failure (offline/timeout). Distinct from an API error so UIs never guess outcomes. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean; status: number; json(): Promise<unknown>; headers: { get(name: string): string | null };
}>;

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: FetchLike;
  /** May be async (e.g. Clerk's getToken refreshes short-lived session tokens). */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Generates idempotency keys for mutations. Defaults to crypto.randomUUID. */
  newIdempotencyKey?: () => string;
  timeoutMs?: number;
}

function qs(params: Record<string, string | string[] | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
    else u.append(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

/**
 * Idempotency key generator. Uses crypto.randomUUID where the runtime provides it (web, modern
 * Hermes); otherwise falls back to crypto.getRandomValues, then to a time+counter+Math.random key.
 * Keys only need to be unique per actor and route, not secret.
 */
let counter = 0;
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) return Array.from(c.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  counter = (counter + 1) % 1_000_000;
  return `k${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const newKey = opts.newIdempotencyKey ?? newIdempotencyKey;
  const base = opts.baseUrl.replace(/\/$/, '');

  async function request<T extends z.ZodType>(
    schema: T,
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<z.infer<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = await opts.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET') headers['idempotency-key'] = idempotencyKey ?? newKey();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000) : undefined;
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(`${base}${path}`, {
        method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch {
      throw new NetworkError();
    } finally {
      if (timer) clearTimeout(timer);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const env = S.ErrorEnvelope.safeParse(json);
      if (env.success) {
        throw new ApiError(res.status, env.data.error.code, env.data.error.message, env.data.error.correlationId, env.data.error.details);
      }
      throw new ApiError(res.status, 'UNEXPECTED_RESPONSE', 'Unexpected error response', res.headers.get('x-correlation-id'));
    }
    return schema.parse(json);
  }

  return {
    // Public catalog — no login required for browsing.
    areas: () => request(S.AreaList, 'GET', '/v1/areas'),
    facets: (type?: z.infer<typeof S.FacetTypeSchema>) => request(S.FacetList, 'GET', `/v1/facets${qs({ type })}`),
    searchOffers: (q: { area: string; mode: string; cuisine?: string[]; dishType?: string[]; cursor?: string; limit?: number }) =>
      request(S.OfferSearchResponse, 'GET', `/v1/catalog/offers${qs(q)}`),
    chef: (id: string) => request(S.PublicChef, 'GET', `/v1/chefs/${encodeURIComponent(id)}`),
    offer: (id: string) => request(S.OfferDetail, 'GET', `/v1/offers/${encodeURIComponent(id)}`),
    groceryCategories: (area: string) => request(S.GroceryCategoryList, 'GET', `/v1/groceries/categories${qs({ area })}`),
    groceryProducts: (area: string, category: string) => request(S.GroceryProductList, 'GET', `/v1/groceries/products${qs({ area, category })}`),
    recipes: () => request(S.RecipeList, 'GET', '/v1/learn/recipes'),
    recipe: (id: string) => request(S.RecipeDetail, 'GET', `/v1/learn/recipes/${encodeURIComponent(id)}`),
    ingredients: () => request(S.IngredientList, 'GET', '/v1/ingredients'),

    // Identity
    me: () => request(S.Me, 'GET', '/v1/me'),
    updateMe: (body: z.input<typeof S.UpdateMeRequest>) => request(S.Me, 'PATCH', '/v1/me', body),
    devToken: (body: z.input<typeof S.DevTokenRequest>) => request(S.DevTokenResponse, 'POST', '/v1/dev/tokens', body),

    // Partners
    applyAsPartner: (body: S.CreatePartnerApplication, key?: string) => request(S.PartnerApplicationDto, 'POST', '/v1/partner-applications', body, key),
    myApplications: () => request(S.PartnerApplicationList, 'GET', '/v1/partner-applications/mine'),
    registerEvidence: (applicationId: string, body: z.input<typeof S.RegisterEvidenceRequest>, key?: string) =>
      request(S.EvidenceRegistered, 'POST', `/v1/partner-applications/${applicationId}/evidence`, body, key),

    // Operations
    opsApplications: (status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' = 'SUBMITTED') =>
      request(S.PartnerApplicationList, 'GET', `/v1/ops/partner-applications${qs({ status })}`),
    opsApplication: (id: string) => request(S.OpsApplicationDetail, 'GET', `/v1/ops/partner-applications/${id}`),
    opsDecide: (id: string, body: S.ApplicationDecisionRequest, key?: string) =>
      request(S.PartnerApplicationDto, 'POST', `/v1/ops/partner-applications/${id}/decision`, body, key),

    // Chef
    chefDishes: (chefId: string) => request(S.ChefDishList, 'GET', `/v1/chef/${chefId}/dishes`),
    createDish: (chefId: string, body: z.input<typeof S.CreateDishRequest>, key?: string) =>
      request(S.ChefDishDto, 'POST', `/v1/chef/${chefId}/dishes`, body, key),

    // Supplier
    myBranches: () => request(S.SupplierBranchList, 'GET', '/v1/supplier/branches'),
    branchProducts: (branchId: string) => request(S.SupplierProductList, 'GET', `/v1/supplier/branches/${branchId}/products`),
    createProduct: (branchId: string, body: z.input<typeof S.CreateProductRequest>, key?: string) =>
      request(S.SupplierProductDto, 'POST', `/v1/supplier/branches/${branchId}/products`, body, key),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
