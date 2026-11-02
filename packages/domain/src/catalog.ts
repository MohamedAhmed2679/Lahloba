import { fail } from './errors';

/** Five customer entry points (doc 01 §1.3). Recipes/guidance are content, not a meal status. */
export type EntryPoint = 'EAT_NOW' | 'HEAT_AT_HOME' | 'COOK_AT_HOME' | 'GROCERIES' | 'LEARN';
export const ENTRY_POINTS: readonly EntryPoint[] = ['EAT_NOW', 'HEAT_AT_HOME', 'COOK_AT_HOME', 'GROCERIES', 'LEARN'];

/** Physical preparation states an offer variant can have. */
export type ServiceMode = 'EAT_NOW' | 'HEAT_AT_HOME' | 'COOK_AT_HOME';
export const SERVICE_MODES: readonly ServiceMode[] = ['EAT_NOW', 'HEAT_AT_HOME', 'COOK_AT_HOME'];

export function isServiceMode(v: unknown): v is ServiceMode {
  return typeof v === 'string' && (SERVICE_MODES as readonly string[]).includes(v);
}

/** Entry points that need a serviceable area before ordering. LEARN browses without location. */
export function entryPointRequiresArea(e: EntryPoint): boolean {
  return e !== 'LEARN';
}

/** Independent facet dimensions replacing the single mixed checkbox list (doc 01 §1.5). */
export type FacetType = 'CUISINE' | 'DISH_TYPE' | 'COURSE' | 'SUPPLIER_CATEGORY' | 'DIET' | 'COLLECTION';
export const FACET_TYPES: readonly FacetType[] = ['CUISINE', 'DISH_TYPE', 'COURSE', 'SUPPLIER_CATEGORY', 'DIET', 'COLLECTION'];
/** Facet types a dish may carry. Supplier categories belong to products; collections group cuisines. */
export const DISH_FACET_TYPES: readonly FacetType[] = ['CUISINE', 'DISH_TYPE', 'COURSE', 'DIET'];

const ARABIC_DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;

/**
 * Normalizes a label/alias for duplicate detection: case, whitespace, punctuation and common
 * Arabic orthographic variants (alef forms, taa marbuta, alef maqsura, diacritics, tatweel).
 * "grills" / "Grills " / "GRILLS" normalize identically.
 */
export function normalizeFacetLabel(input: string): string {
  if (typeof input !== 'string') fail('INVALID_TEXT', 'label must be text');
  const out = input
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!out) fail('INVALID_TEXT', 'label must contain letters or digits');
  return out;
}

export interface FacetAliasRecord { facetId: string; facetType: FacetType; alias: string }

/**
 * Resolves raw labels (e.g. from a legacy checkbox list) to canonical facet IDs, collapsing
 * duplicates. Unknown labels are returned separately rather than guessed.
 */
export function resolveFacetLabels(labels: string[], aliases: FacetAliasRecord[]) {
  const index = new Map<string, FacetAliasRecord>();
  for (const a of aliases) index.set(normalizeFacetLabel(a.alias), a);
  const resolved = new Map<string, FacetAliasRecord>();
  const unknown: string[] = [];
  for (const label of labels) {
    const hit = index.get(normalizeFacetLabel(label));
    if (hit) resolved.set(hit.facetId, hit);
    else unknown.push(label);
  }
  return { resolved: [...resolved.values()], unknown };
}
