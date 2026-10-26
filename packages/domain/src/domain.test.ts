import { describe, expect, it } from 'vitest';
import {
  DomainError, assertQuoteValid, assertServingsAllowed, availableInterfaces, canManageBranch, canManageChef,
  canReviewPartnerApplications, isSelfReview, laborTotal, multiply, normalizeFacetLabel, packRequirement,
  publishBlockers, quoteMeal, resolveFacetLabels, stepServings, transition, validateFinalTrip,
  type Actor, type PublishCandidate, type QuoteInput,
} from './index';

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { if (e instanceof DomainError) return e.code; throw e; }
  return 'NO_ERROR';
};

const supplierInput: QuoteInput = {
  source: 'SUPPLIERS', servings: 4, laborPerPersonPiastres: 1000, chefId: 'chef-A',
  finalCourierId: 'leg-2-payee', finalTripPiastres: 4500, routeEligible: true, packagingPiastres: 1200,
  ingredientCourierId: 'leg-1-payee', ingredientRouteEligible: true,
  supplierLines: [
    { ingredientId: 'chicken', supplierId: 'supplier-A', gramsPerPerson: 150, packGrams: 500, packPricePiastres: 9000 },
    { ingredientId: 'rice', supplierId: 'supplier-B', gramsPerPerson: 100, packGrams: 1000, packPricePiastres: 6000 },
  ],
};

describe('money and portions (ported starter invariants)', () => {
  it('founder labor example: 10 EGP x 4 = 40 EGP', () => expect(laborTotal(1000, 4)).toBe(4000));
  it('retail packs round up and expose surplus', () =>
    expect(packRequirement(150, 4, 500)).toEqual({ requiredQuantity: 600, packs: 2, purchasedQuantity: 1000, leftoverQuantity: 400 }));
  it('exact pack multiple has zero surplus', () => expect(packRequirement(250, 4, 500).leftoverQuantity).toBe(0));
  it('rejects fractional and negative money', () => {
    expect(code(() => multiply(10.5, 2))).toBe('INVALID_INTEGER');
    expect(code(() => multiply(-1, 2))).toBe('INVALID_INTEGER');
  });
  it('rejects unsafe integer multiplication', () => expect(code(() => multiply(Number.MAX_SAFE_INTEGER, 2))).toBe('INVALID_INTEGER'));
  it('rejects zero and fractional servings', () => {
    expect(code(() => laborTotal(1000, 0))).toBe('INVALID_INTEGER');
    expect(code(() => laborTotal(1000, 1.5))).toBe('INVALID_INTEGER');
  });
  it('enforces min/max/step serving rules', () => {
    const r = { minServings: 2, maxServings: 8, servingStep: 2 };
    expect(assertServingsAllowed(4, r)).toBe(4);
    expect(code(() => assertServingsAllowed(3, r))).toBe('INVALID_SERVINGS');
    expect(code(() => assertServingsAllowed(10, r))).toBe('INVALID_SERVINGS');
    expect(stepServings(8, 1, r)).toBeNull();
    expect(stepServings(2, -1, r)).toBeNull();
    expect(stepServings(4, 1, r)).toBe(6);
  });
});

describe('quotes (ported; endpoints arrive in Slice 2)', () => {
  it('illustrative supplier total and payee conservation = 357 EGP shape', () => {
    const q = quoteMeal({ ...supplierInput, supplierLines: [
      { ingredientId: 'basket', supplierId: 'supplier-A', gramsPerPerson: 1, packGrams: 4, packPricePiastres: 24000 },
    ] }, 0);
    expect(q.totalPiastres).toBe(35700);
    expect(Object.values(q.allocations).reduce((a, b) => a + b, 0)).toBe(q.totalPiastres);
  });
  it('chef receives labor and packaging, not supplier ingredient revenue', () => {
    const q = quoteMeal(supplierInput, 0);
    expect(q.allocations['chef-A']).toBe(4000 + 1200);
  });
  it('ingredient trip is once per order, not per person or supplier', () => {
    const q = quoteMeal(supplierInput, 0);
    expect(q.lines.filter((l) => l.component === 'INGREDIENT_TRIP')).toEqual([
      { component: 'INGREDIENT_TRIP', recipientId: 'leg-1-payee', amountPiastres: 2000 },
    ]);
  });
  it('chef source has no ingredient collection leg', () => {
    const q = quoteMeal({ ...supplierInput, source: 'CHEF', supplierLines: [], chefIngredientPiastres: 20000 }, 0);
    expect(q.lines.some((l) => l.component === 'INGREDIENT_TRIP')).toBe(false);
  });
  it('final tariff bounds and eligibility', () => {
    expect(validateFinalTrip(2000, true)).toBe(2000);
    expect(validateFinalTrip(7500, true)).toBe(7500);
    expect(code(() => validateFinalTrip(7600, true))).toBe('TARIFF_RANGE');
    expect(code(() => validateFinalTrip(4500, false))).toBe('UNSERVICEABLE');
    expect(code(() => quoteMeal({ ...supplierInput, ingredientRouteEligible: false }, 0))).toBe('UNSERVICEABLE');
  });
  it('source ownership, empty basket and duplicate ingredients rejected', () => {
    expect(code(() => quoteMeal({ ...supplierInput, chefIngredientPiastres: 100 }, 0))).toBe('SOURCE_OWNERSHIP');
    expect(code(() => quoteMeal({ ...supplierInput, supplierLines: [] }, 0))).toBe('INCOMPLETE_BASKET');
    const dup = supplierInput.supplierLines![0]!;
    expect(code(() => quoteMeal({ ...supplierInput, supplierLines: [dup, dup] }, 0))).toBe('DUPLICATE_INGREDIENT');
  });
  it('quote expires at exact boundary; tax needs explicit recipient', () => {
    const q = quoteMeal(supplierInput, 1000);
    expect(assertQuoteValid(q, q.expiresAt - 1)).toBe(true);
    expect(code(() => assertQuoteValid(q, q.expiresAt))).toBe('QUOTE_EXPIRED');
    expect(code(() => quoteMeal({ ...supplierInput, taxPiastres: 100 }, 0))).toBe('INVALID_TEXT');
  });
});

describe('fulfillment state guards (ported)', () => {
  const reserved = { state: 'RESERVED' as const, source: 'SUPPLIERS' as const, version: 1 };
  it('blocks confirmation without funding and rejects stale versions', () => {
    expect(code(() => transition(reserved, 'CONFIRM', { expectedVersion: 1, partnersConfirmed: true }))).toBe('NOT_CONFIRMED');
    expect(code(() => transition(reserved, 'CONFIRM', { expectedVersion: 0, partnersConfirmed: true, fundingConfirmed: true }))).toBe('VERSION_CONFLICT');
  });
  it('cannot skip to cooking; partial ingredient acceptance blocks', () => {
    expect(code(() => transition(reserved, 'START_PREPARATION', { expectedVersion: 1 }))).toBe('INVALID_TRANSITION');
    const awaiting = transition(reserved, 'CONFIRM', { expectedVersion: 1, partnersConfirmed: true, fundingConfirmed: true });
    expect(awaiting.state).toBe('AWAITING_INGREDIENTS');
    expect(code(() => transition(awaiting, 'ACCEPT_INGREDIENTS', { expectedVersion: 2, allRequiredAccepted: false, handoffVerified: true }))).toBe('INGREDIENTS_NOT_ACCEPTED');
  });
  it('full supplier happy path with all gates', () => {
    let o = transition(reserved, 'CONFIRM', { expectedVersion: 1, partnersConfirmed: true, fundingConfirmed: true });
    o = transition(o, 'ACCEPT_INGREDIENTS', { expectedVersion: 2, allRequiredAccepted: true, handoffVerified: true });
    o = transition(o, 'START_PREPARATION', { expectedVersion: 3, fundingConfirmed: true, capacityConfirmed: true });
    expect(code(() => transition(o, 'FINAL_PICKUP', { expectedVersion: 4, assignedCourier: true, handoffVerified: true }))).toBe('INVALID_TRANSITION');
    o = transition(o, 'MARK_READY', { expectedVersion: 4, packed: true, instructionsAttached: true });
    o = transition(o, 'FINAL_PICKUP', { expectedVersion: 5, assignedCourier: true, handoffVerified: true });
    expect(code(() => transition(o, 'DELIVER', { expectedVersion: 6 }))).toBe('HANDOFF_REQUIRED');
    o = transition(o, 'DELIVER', { expectedVersion: 6, recipientProofVerified: true });
    expect(o.state).toBe('DELIVERED');
  });
  it('chef-sourced preparation needs an ingredient check', () => {
    const ready = { state: 'READY_TO_PREPARE' as const, source: 'CHEF' as const, version: 1 };
    expect(code(() => transition(ready, 'START_PREPARATION', { expectedVersion: 1, fundingConfirmed: true, capacityConfirmed: true }))).toBe('INGREDIENTS_NOT_ACCEPTED');
  });
});

describe('facet normalization', () => {
  it('collapses duplicate grills/Grills and grocery/Grocery', () => {
    expect(normalizeFacetLabel('Grills ')).toBe(normalizeFacetLabel('grills'));
    expect(normalizeFacetLabel('Grocery')).toBe('grocery');
  });
  it('normalizes Arabic alef forms, taa marbuta, tatweel and diacritics', () => {
    expect(normalizeFacetLabel('مشويات')).toBe(normalizeFacetLabel('مشـويات'));
    expect(normalizeFacetLabel('أكلة')).toBe(normalizeFacetLabel('اكله'));
    expect(normalizeFacetLabel('مَشْوِيّات')).toBe(normalizeFacetLabel('مشويات'));
  });
  it('rejects empty labels', () => expect(code(() => normalizeFacetLabel(' -- '))).toBe('INVALID_TEXT'));
  it('resolves duplicates to one facet and reports unknown labels instead of guessing', () => {
    const r = resolveFacetLabels(['grills', 'Grills', 'Pet Shop'], [{ facetId: 'f1', facetType: 'DISH_TYPE', alias: 'grills' }]);
    expect(r.resolved.map((x) => x.facetId)).toEqual(['f1']);
    expect(r.unknown).toEqual(['Pet Shop']);
  });
});

describe('scoped authorization', () => {
  const actor = (memberships: Actor['memberships'], status: Actor['status'] = 'ACTIVE'): Actor => ({ userId: 'u1', status, memberships });
  const m = (role: any, scopeType: any, scopeId: string | null, approvalState: any = 'APPROVED') => ({ id: role + scopeId, role, scopeType, scopeId, approvalState });

  it('chef membership is scoped to its own chef', () => {
    const a = actor([m('CHEF_OWNER', 'CHEF', 'chef-1')]);
    expect(canManageChef(a, 'chef-1')).toBe(true);
    expect(canManageChef(a, 'chef-2')).toBe(false);
  });
  it('pending membership only counts when explicitly allowed', () => {
    const a = actor([m('CHEF_OWNER', 'CHEF', 'chef-1', 'PENDING')]);
    expect(canManageChef(a, 'chef-1')).toBe(false);
    expect(canManageChef(a, 'chef-1', { allowPending: true })).toBe(true);
  });
  it('suspended users and rejected memberships get nothing', () => {
    expect(canManageChef(actor([m('CHEF_OWNER', 'CHEF', 'chef-1')], 'SUSPENDED'), 'chef-1')).toBe(false);
    expect(canReviewPartnerApplications(actor([m('OPS_VERIFIER', 'GLOBAL', null, 'REJECTED')]))).toBe(false);
  });
  it('supplier staff is branch-scoped; owner is org-scoped', () => {
    const staff = actor([m('SUPPLIER_STAFF', 'SUPPLIER_BRANCH', 'b1')]);
    expect(canManageBranch(staff, { branchId: 'b1', organizationId: 'o1' })).toBe(true);
    expect(canManageBranch(staff, { branchId: 'b2', organizationId: 'o1' })).toBe(false);
    const owner = actor([m('SUPPLIER_OWNER', 'SUPPLIER_ORG', 'o1')]);
    expect(canManageBranch(owner, { branchId: 'b2', organizationId: 'o1' })).toBe(true);
  });
  it('a chef role never grants ops review; self review is detected', () => {
    const a = actor([m('CHEF_OWNER', 'CHEF', 'chef-1'), m('CUSTOMER', 'GLOBAL', null)]);
    expect(canReviewPartnerApplications(a)).toBe(false);
    expect(isSelfReview(a, 'u1')).toBe(true);
  });
  it('role switcher lists interfaces separately, hiding rejected ones', () => {
    const a = actor([m('CUSTOMER', 'GLOBAL', null), m('CHEF_OWNER', 'CHEF', 'c1', 'PENDING'), m('COURIER', 'COURIER', 'k1', 'REJECTED')]);
    expect(availableInterfaces(a).map((x) => x.ui)).toEqual(['CUSTOMER', 'CHEF']);
  });
});

describe('publish readiness (H01/H03)', () => {
  const good: PublishCandidate = {
    chefStatus: 'APPROVED', membershipApproved: true, titleEn: 'Molokhia', titleAr: 'ملوخية', cuisineFacetCount: 1,
    variants: [{ status: 'ACTIVE', serviceMode: 'EAT_NOW', recipePublished: true, requirementCount: 3,
      safetyInstructionsEn: 'Eat within 2 hours.', safetyInstructionsAr: 'يؤكل خلال ساعتين.', chefIngredientsOffered: true, supplierSourcingAllowed: false }],
  };
  it('passes a complete candidate', () => expect(publishBlockers(good)).toEqual([]));
  it('blocks unapproved chef and missing safety/translation data', () => {
    const b = publishBlockers({ ...good, chefStatus: 'PENDING', titleAr: ' ',
      variants: [{ ...good.variants[0]!, safetyInstructionsAr: null, recipePublished: false }] });
    expect(b).toEqual(expect.arrayContaining(['CHEF_NOT_APPROVED', 'TITLE_MISSING_AR', 'SAFETY_INSTRUCTIONS_MISSING', 'RECIPE_NOT_PUBLISHED']));
  });
  it('blocks a variant with no sourcing strategy', () => {
    expect(publishBlockers({ ...good, variants: [{ ...good.variants[0]!, chefIngredientsOffered: false }] })).toContain('NO_SOURCING_STRATEGY');
  });
});

describe('EGP input parsing', () => {
  it('parses to integer piastres without float error', async () => {
    const { parseEgpToPiastres } = await import('./money');
    expect(parseEgpToPiastres('45')).toBe(4500);
    expect(parseEgpToPiastres('45.5')).toBe(4550);
    expect(parseEgpToPiastres('0.07')).toBe(7);
    expect(parseEgpToPiastres('١٠')).toBe(1000);
    expect(parseEgpToPiastres('10.005')).toBeNull();
    expect(parseEgpToPiastres('-1')).toBeNull();
    expect(parseEgpToPiastres('1e3')).toBeNull();
    expect(parseEgpToPiastres('')).toBeNull();
  });
});
