export type DomainErrorCode =
  | 'INVALID_INTEGER'
  | 'INVALID_TEXT'
  | 'INVALID_SERVINGS'
  | 'INVALID_SOURCE'
  | 'UNSERVICEABLE'
  | 'TARIFF_RANGE'
  | 'SOURCE_OWNERSHIP'
  | 'INCOMPLETE_BASKET'
  | 'DUPLICATE_INGREDIENT'
  | 'ALLOCATION_MISMATCH'
  | 'QUOTE_EXPIRED'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'NOT_CONFIRMED'
  | 'INGREDIENTS_NOT_ACCEPTED'
  | 'PREP_BLOCKED'
  | 'NOT_PACKED'
  | 'HANDOFF_REQUIRED'
  | 'UNKNOWN_EVENT'
  | 'UNIT_MISMATCH'
  | 'PUBLISH_BLOCKED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function fail(code: DomainErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new DomainError(code, message, details);
}
