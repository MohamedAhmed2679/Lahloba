import { fail } from './errors';
import { integer, multiply } from './money';

export type CanonicalUnit = 'g' | 'ml' | 'count';
export const CANONICAL_UNITS: readonly CanonicalUnit[] = ['g', 'ml', 'count'];

/** Distinct weight bases; raw ingredient weights never imply a cooked weight. */
export type WeightBasis = 'RAW_EDIBLE' | 'AS_PURCHASED' | 'COOKED_NET';
export const WEIGHT_BASES: readonly WeightBasis[] = ['RAW_EDIBLE', 'AS_PURCHASED', 'COOKED_NET'];

export interface ServingRules {
  minServings: number;
  maxServings: number;
  servingStep: number;
}

export function validateServingRules(r: ServingRules): ServingRules {
  integer(r.minServings, 'minServings', 1);
  integer(r.maxServings, 'maxServings', 1);
  integer(r.servingStep, 'servingStep', 1);
  if (r.maxServings < r.minServings) fail('INVALID_SERVINGS', 'maxServings must be >= minServings');
  return r;
}

/** Servings must be within [min, max] and reachable from min in whole steps. */
export function assertServingsAllowed(servings: number, r: ServingRules): number {
  validateServingRules(r);
  integer(servings, 'servings', 1);
  if (servings < r.minServings || servings > r.maxServings || (servings - r.minServings) % r.servingStep !== 0) {
    fail('INVALID_SERVINGS', 'Servings are outside this offer’s allowed range or step', { ...r, servings });
  }
  return servings;
}

/** Next allowed servings value when stepping, clamped to the rules. Returns null at the bound. */
export function stepServings(current: number, direction: 1 | -1, r: ServingRules): number | null {
  const next = current + direction * r.servingStep;
  if (next < r.minServings || next > r.maxServings) return null;
  return next;
}

/** Founder rule: cooking fee is chef-set per person. 10 EGP x 4 = 40 EGP. */
export function laborTotal(laborPerPersonPiastres: number, servings: number): number {
  integer(servings, 'servings', 1);
  return multiply(laborPerPersonPiastres, servings);
}

export interface PackRequirement {
  requiredQuantity: number;
  packs: number;
  purchasedQuantity: number;
  leftoverQuantity: number;
}

/** Retail packs round up; surplus is exposed, not hidden. Integer canonical units only. */
export function packRequirement(perServing: number, servings: number, packQuantity: number): PackRequirement {
  integer(perServing, 'perServing', 1);
  integer(servings, 'servings', 1);
  integer(packQuantity, 'packQuantity', 1);
  const requiredQuantity = multiply(perServing, servings);
  const packs = Math.ceil(requiredQuantity / packQuantity);
  const purchasedQuantity = multiply(packs, packQuantity);
  return { requiredQuantity, packs, purchasedQuantity, leftoverQuantity: purchasedQuantity - requiredQuantity };
}

/** Units never convert silently (no ml->g without an ingredient-specific density). */
export function assertSameUnit(a: CanonicalUnit, b: CanonicalUnit): void {
  if (a !== b) fail('UNIT_MISMATCH', `Unit ${a} cannot be used as ${b} without a declared conversion`);
}
