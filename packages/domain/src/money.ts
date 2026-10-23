import { fail } from './errors';

/** Money is always integer piastres (1 EGP = 100 piastres). Never floating point. */
export type Piastres = number;
export const PIASTRES_PER_EGP = 100;

export function integer(value: unknown, name: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    fail('INVALID_INTEGER', `${name} must be a safe integer >= ${min}`, { name });
  }
  return value;
}

export function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_TEXT', `${name} is required`, { name });
  return value;
}

export function sum(values: readonly number[]): number {
  return values.reduce<number>((a, b) => integer(a + integer(b, 'amount'), 'sum'), 0);
}

export function multiply(a: number, b: number): number {
  return integer(integer(a, 'factor') * integer(b, 'factor'), 'product');
}

export function egpToPiastres(egp: number): Piastres {
  integer(egp, 'egp');
  return multiply(egp, PIASTRES_PER_EGP);
}

/**
 * Parses user-entered EGP text ("45", "45.5", "45.50", Arabic-Indic digits) into integer
 * piastres without floating-point arithmetic. Returns null for anything else.
 */
export function parseEgpToPiastres(input: string): number | null {
  const ascii = input.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace('٫', '.');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(ascii);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  const v = whole * PIASTRES_PER_EGP + frac;
  return Number.isSafeInteger(v) ? v : null;
}
