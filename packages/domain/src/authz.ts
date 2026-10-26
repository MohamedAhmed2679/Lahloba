/**
 * Scoped role memberships and authorization policy. Pure functions: the API resolves the
 * actor from a verified identity token and the database, then calls these. Hidden navigation
 * in a client is never a substitute for these checks.
 */
export type Role =
  | 'CUSTOMER'
  | 'CHEF_OWNER'
  | 'CHEF_STAFF'
  | 'SUPPLIER_OWNER'
  | 'SUPPLIER_STAFF'
  | 'COURIER'
  | 'OPS_VERIFIER'
  | 'OPS_ADMIN';

export type ScopeType = 'GLOBAL' | 'CHEF' | 'SUPPLIER_ORG' | 'SUPPLIER_BRANCH' | 'COURIER';
export type ApprovalState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'REVOKED';

export const ROLE_SCOPE: Record<Role, ScopeType> = {
  CUSTOMER: 'GLOBAL',
  CHEF_OWNER: 'CHEF',
  CHEF_STAFF: 'CHEF',
  SUPPLIER_OWNER: 'SUPPLIER_ORG',
  SUPPLIER_STAFF: 'SUPPLIER_BRANCH',
  COURIER: 'COURIER',
  OPS_VERIFIER: 'GLOBAL',
  OPS_ADMIN: 'GLOBAL',
};

export interface Membership {
  id: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
  approvalState: ApprovalState;
}

export interface Actor {
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED';
  memberships: Membership[];
}

export type PublicRoleInterface = 'CUSTOMER' | 'CHEF' | 'SUPPLIER' | 'COURIER';

interface MatchOptions {
  /** Default true: only APPROVED memberships grant access. */
  approvedOnly?: boolean;
  /** Also accept PENDING (e.g. a chef drafting a menu before approval). */
  allowPending?: boolean;
}

function stateAllowed(m: Membership, o: MatchOptions): boolean {
  if (m.approvalState === 'APPROVED') return true;
  return o.allowPending === true && m.approvalState === 'PENDING';
}

export function hasGlobalRole(actor: Actor, roles: Role[]): boolean {
  if (actor.status !== 'ACTIVE') return false;
  return actor.memberships.some((m) => roles.includes(m.role) && m.scopeType === 'GLOBAL' && m.approvalState === 'APPROVED');
}

export function canReviewPartnerApplications(actor: Actor): boolean {
  return hasGlobalRole(actor, ['OPS_VERIFIER', 'OPS_ADMIN']);
}

export function canManageChef(actor: Actor, chefId: string, o: MatchOptions = {}): boolean {
  if (actor.status !== 'ACTIVE') return false;
  return actor.memberships.some(
    (m) => (m.role === 'CHEF_OWNER' || m.role === 'CHEF_STAFF') && m.scopeType === 'CHEF' && m.scopeId === chefId && stateAllowed(m, o),
  );
}

/** Supplier owner (org scope) or branch staff (branch scope) for the given branch. */
export function canManageBranch(actor: Actor, branch: { branchId: string; organizationId: string }, o: MatchOptions = {}): boolean {
  if (actor.status !== 'ACTIVE') return false;
  return actor.memberships.some(
    (m) =>
      stateAllowed(m, o) &&
      ((m.role === 'SUPPLIER_OWNER' && m.scopeType === 'SUPPLIER_ORG' && m.scopeId === branch.organizationId) ||
        (m.role === 'SUPPLIER_STAFF' && m.scopeType === 'SUPPLIER_BRANCH' && m.scopeId === branch.branchId)),
  );
}

/** Separation of duties: nobody reviews their own application (O01). */
export function isSelfReview(actor: Actor, applicantUserId: string): boolean {
  return actor.userId === applicantUserId;
}

/** Interfaces the actor may switch into. Switching never merges permissions. */
export function availableInterfaces(actor: Actor): Array<{ ui: PublicRoleInterface; scopeId: string | null; approvalState: ApprovalState }> {
  const out: Array<{ ui: PublicRoleInterface; scopeId: string | null; approvalState: ApprovalState }> = [];
  for (const m of actor.memberships) {
    if (m.approvalState === 'REJECTED' || m.approvalState === 'REVOKED') continue;
    if (m.role === 'CUSTOMER') out.push({ ui: 'CUSTOMER', scopeId: null, approvalState: m.approvalState });
    else if (m.role === 'CHEF_OWNER' || m.role === 'CHEF_STAFF') out.push({ ui: 'CHEF', scopeId: m.scopeId, approvalState: m.approvalState });
    else if (m.role === 'SUPPLIER_OWNER' || m.role === 'SUPPLIER_STAFF') out.push({ ui: 'SUPPLIER', scopeId: m.scopeId, approvalState: m.approvalState });
    else if (m.role === 'COURIER') out.push({ ui: 'COURIER', scopeId: m.scopeId, approvalState: m.approvalState });
  }
  return out;
}
