// Ported from the reference starter (starter/domain.mjs) with types.
// Slice 1 only exposes this as tested domain logic; quote endpoints arrive in Slice 2.
// Production callers must supply authoritative catalog/routing values, never request-body prices.
import { fail } from './errors';
import { integer, multiply, sum, text } from './money';
import { packRequirement } from './portions';

export type IngredientSource = 'CHEF' | 'SUPPLIERS';
export type QuoteComponent =
  | 'LABOR' | 'PACKAGING' | 'INGREDIENTS' | 'INGREDIENT_TRIP' | 'FINAL_TRIP' | 'SERVICE_FEE' | 'TAX';

/** Founder rule: one eligible consolidated ingredient trip to the chef = 20 EGP. */
export const INGREDIENT_TRIP_PIASTRES = 2000;
/** Founder rule: final delivery 20–75 EGP for eligible routes. Distance bands are NOT defined. */
export const FINAL_TRIP_MIN_PIASTRES = 2000;
export const FINAL_TRIP_MAX_PIASTRES = 7500;

export interface SupplierLineInput {
  ingredientId: string;
  supplierId: string;
  gramsPerPerson: number;
  packGrams: number;
  packPricePiastres: number;
}

export interface QuoteInput {
  source: IngredientSource;
  servings: number;
  laborPerPersonPiastres: number;
  chefId: string;
  finalCourierId: string;
  finalTripPiastres: number;
  routeEligible: boolean;
  packagingPiastres?: number;
  serviceFeePiastres?: number;
  taxPiastres?: number;
  taxRecipientId?: string;
  supplierLines?: SupplierLineInput[];
  chefIngredientPiastres?: number;
  ingredientCourierId?: string;
  ingredientRouteEligible?: boolean;
  ttlMs?: number;
}

export interface QuoteLine { component: QuoteComponent; recipientId: string; amountPiastres: number }

export interface Quote {
  currency: 'EGP';
  source: IngredientSource;
  servings: number;
  lines: QuoteLine[];
  ingredientDetails: Array<SupplierLineInput & {
    requiredQuantity: number; packs: number; purchasedQuantity: number; leftoverQuantity: number;
    amountPiastres: number; weightBasis: 'AS_PURCHASED';
  }>;
  allocations: Record<string, number>;
  totalPiastres: number;
  createdAt: number;
  expiresAt: number;
  version: 1;
}

export function validateFinalTrip(finalTripPiastres: number, eligible: boolean): number {
  if (eligible !== true) fail('UNSERVICEABLE', 'Route is outside approved service eligibility');
  integer(finalTripPiastres, 'finalTripPiastres');
  if (finalTripPiastres < FINAL_TRIP_MIN_PIASTRES || finalTripPiastres > FINAL_TRIP_MAX_PIASTRES) {
    fail('TARIFF_RANGE', 'Final trip must be 20-75 EGP for eligible routes');
  }
  return finalTripPiastres;
}

export function quoteMeal(input: QuoteInput, now: number = Date.now()): Quote {
  const {
    source, servings, laborPerPersonPiastres, chefId, finalCourierId, finalTripPiastres, routeEligible,
    packagingPiastres = 0, serviceFeePiastres = 0, taxPiastres = 0, supplierLines = [],
    chefIngredientPiastres = 0, ingredientCourierId, ingredientRouteEligible, ttlMs = 300_000,
  } = input;
  if (source !== 'CHEF' && source !== 'SUPPLIERS') fail('INVALID_SOURCE', 'Source must be CHEF or SUPPLIERS');
  integer(servings, 'servings', 1);
  integer(now, 'now');
  integer(ttlMs, 'ttlMs', 1);
  text(chefId, 'chefId');
  text(finalCourierId, 'finalCourierId');
  validateFinalTrip(finalTripPiastres, routeEligible);

  const lines: QuoteLine[] = [];
  const add = (component: QuoteComponent, recipientId: string | undefined, amountPiastres: number) => {
    integer(amountPiastres, component);
    if (amountPiastres) lines.push({ component, recipientId: text(recipientId, 'recipientId'), amountPiastres });
  };
  add('LABOR', chefId, multiply(laborPerPersonPiastres, servings));
  add('PACKAGING', chefId, packagingPiastres);

  const ingredientDetails: Quote['ingredientDetails'] = [];
  if (source === 'SUPPLIERS') {
    if (chefIngredientPiastres !== 0) fail('SOURCE_OWNERSHIP', 'Supplier-sourced order cannot charge chef ingredients');
    if (ingredientRouteEligible !== true) fail('UNSERVICEABLE', 'Ingredient trip is not eligible for the 20 EGP tariff');
    text(ingredientCourierId, 'ingredientCourierId');
    if (!Array.isArray(supplierLines) || supplierLines.length === 0) {
      fail('INCOMPLETE_BASKET', 'Supplier ingredient basket is required');
    }
    const seen = new Set<string>();
    for (const line of supplierLines) {
      text(line.ingredientId, 'ingredientId');
      text(line.supplierId, 'supplierId');
      if (seen.has(line.ingredientId)) fail('DUPLICATE_INGREDIENT', 'One supplier choice per ingredient');
      seen.add(line.ingredientId);
      const q = packRequirement(line.gramsPerPerson, servings, line.packGrams);
      const amountPiastres = multiply(q.packs, line.packPricePiastres);
      ingredientDetails.push({ ...line, ...q, amountPiastres, weightBasis: 'AS_PURCHASED' });
      add('INGREDIENTS', line.supplierId, amountPiastres);
    }
    add('INGREDIENT_TRIP', ingredientCourierId, INGREDIENT_TRIP_PIASTRES);
  } else {
    if (supplierLines.length) fail('SOURCE_OWNERSHIP', 'Chef-sourced quote cannot contain supplier charges');
    add('INGREDIENTS', chefId, chefIngredientPiastres);
  }
  add('FINAL_TRIP', finalCourierId, finalTripPiastres);
  add('SERVICE_FEE', 'platform', serviceFeePiastres);
  if (taxPiastres) add('TAX', text(input.taxRecipientId, 'taxRecipientId'), taxPiastres);

  const allocations: Record<string, number> = Object.create(null);
  for (const line of lines) allocations[line.recipientId] = sum([allocations[line.recipientId] ?? 0, line.amountPiastres]);
  const totalPiastres = sum(lines.map((x) => x.amountPiastres));
  if (sum(Object.values(allocations)) !== totalPiastres) fail('ALLOCATION_MISMATCH', 'Payees do not sum to total');
  return {
    currency: 'EGP', source, servings, lines, ingredientDetails, allocations, totalPiastres,
    createdAt: now, expiresAt: integer(now + ttlMs, 'expiresAt'), version: 1,
  };
}

export function assertQuoteValid(quote: Pick<Quote, 'expiresAt'>, now: number = Date.now()): true {
  integer(now, 'now');
  if (now >= quote.expiresAt) fail('QUOTE_EXPIRED', 'Quote expired; obtain a new quote');
  return true;
}
