import { DomainError } from '@lahloba/domain';
import { ZodError } from 'zod';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (message = 'You are not allowed to perform this action') => new HttpError(403, 'FORBIDDEN', message);
export const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'Sign-in required');
export const conflict = (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details);

interface PgError { code?: string; constraint?: string }

/** Maps any thrown error to a safe HTTP error. Messages never echo submitted values or SQL. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ZodError) {
    return new HttpError(400, 'VALIDATION_FAILED', 'Request validation failed', {
      issues: err.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
    });
  }
  if (err instanceof DomainError) {
    const status = err.code === 'VERSION_CONFLICT' ? 409 : 422;
    return new HttpError(status, err.code, err.message, err.details);
  }
  const pgErr = err as PgError;
  if (pgErr && typeof pgErr.code === 'string') {
    if (pgErr.code === '23505') return conflict('ALREADY_EXISTS', 'A conflicting record already exists', { constraint: pgErr.constraint });
    if (pgErr.code === '23514' || pgErr.code === '23503' || pgErr.code === '23502') {
      return new HttpError(422, 'CONSTRAINT_VIOLATION', 'The request violates a data rule', { constraint: pgErr.constraint });
    }
    if (pgErr.code === '40001' || pgErr.code === '40P01') return conflict('RETRY', 'Concurrent update; retry the request');
  }
  const status = (err as { statusCode?: number })?.statusCode;
  if (status === 429) return new HttpError(429, 'RATE_LIMITED', 'Too many requests');
  if (status && status >= 400 && status < 500) return new HttpError(status, 'BAD_REQUEST', 'Malformed request');
  return new HttpError(500, 'INTERNAL', 'Unexpected server error');
}
