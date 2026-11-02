import type { ServiceMode } from './catalog';

/** Reasons a dish cannot enter live discovery (H01, H03). Empty list = publishable. */
export type PublishBlocker =
  | 'CHEF_NOT_APPROVED'
  | 'MEMBERSHIP_NOT_APPROVED'
  | 'TITLE_MISSING_EN'
  | 'TITLE_MISSING_AR'
  | 'NO_ACTIVE_VARIANT'
  | 'RECIPE_NOT_PUBLISHED'
  | 'RECIPE_HAS_NO_INGREDIENTS'
  | 'SAFETY_INSTRUCTIONS_MISSING'
  | 'NO_SOURCING_STRATEGY'
  | 'NO_CUISINE_FACET';

export interface PublishCandidate {
  chefStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  membershipApproved: boolean;
  titleEn: string | null;
  titleAr: string | null;
  cuisineFacetCount: number;
  variants: Array<{
    status: 'ACTIVE' | 'INACTIVE';
    serviceMode: ServiceMode;
    recipePublished: boolean;
    requirementCount: number;
    safetyInstructionsEn: string | null;
    safetyInstructionsAr: string | null;
    chefIngredientsOffered: boolean;
    supplierSourcingAllowed: boolean;
  }>;
}

const blank = (s: string | null) => !s || !s.trim();

export function publishBlockers(c: PublishCandidate): PublishBlocker[] {
  const out = new Set<PublishBlocker>();
  if (c.chefStatus !== 'APPROVED') out.add('CHEF_NOT_APPROVED');
  if (!c.membershipApproved) out.add('MEMBERSHIP_NOT_APPROVED');
  if (blank(c.titleEn)) out.add('TITLE_MISSING_EN');
  if (blank(c.titleAr)) out.add('TITLE_MISSING_AR');
  if (c.cuisineFacetCount < 1) out.add('NO_CUISINE_FACET');
  const active = c.variants.filter((v) => v.status === 'ACTIVE');
  if (active.length === 0) out.add('NO_ACTIVE_VARIANT');
  for (const v of active) {
    if (!v.recipePublished) out.add('RECIPE_NOT_PUBLISHED');
    if (v.requirementCount < 1) out.add('RECIPE_HAS_NO_INGREDIENTS');
    // Every physical variant needs handling instructions in both languages (doc 06 §6.2).
    if (blank(v.safetyInstructionsEn) || blank(v.safetyInstructionsAr)) out.add('SAFETY_INSTRUCTIONS_MISSING');
    if (!v.chefIngredientsOffered && !v.supplierSourcingAllowed) out.add('NO_SOURCING_STRATEGY');
  }
  return [...out];
}
