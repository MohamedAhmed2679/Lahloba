import { ar } from './ar';
import { en, type MessageKey } from './en';

export type Locale = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';
export type { MessageKey };
export const LOCALES: readonly Locale[] = ['en', 'ar'];

const resources: Record<Locale, Record<MessageKey, string>> = { en, ar };

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'ar';
}

export function direction(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** BCP-47 tag used for Intl formatting. Egypt-first. */
export function intlTag(locale: Locale): string {
  return locale === 'ar' ? 'ar-EG' : 'en-EG';
}

export type Vars = Record<string, string | number>;

/** Translate with {placeholder} interpolation. Missing vars stay visible rather than vanish. */
export function t(locale: Locale, key: MessageKey, vars?: Vars): string {
  const template = resources[locale][key] ?? resources.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

const WESTERN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * Money is integer piastres; display EGP. Brand recommendation (pending founder decision):
 * Western digits in both languages, "EGP 185" in English and "185 ج.م" in Arabic.
 */
export function formatMoney(piastres: number, locale: Locale): string {
  if (!Number.isSafeInteger(piastres)) throw new RangeError('piastres must be a safe integer');
  const whole = Math.trunc(piastres / 100);
  const frac = Math.abs(piastres % 100);
  const n = `${piastres < 0 ? '-' : ''}${WESTERN.format(Math.abs(whole))}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
  return locale === 'ar' ? `${n} ج.م` : `EGP ${n}`;
}

export type Unit = 'g' | 'ml' | 'count';

/** Quantities in canonical units. Grams are never converted to/from millilitres here. */
export function formatQuantity(quantity: number, unit: Unit, locale: Locale): string {
  const n = WESTERN.format(quantity);
  if (unit === 'count') return locale === 'ar' ? `${n} قطعة` : `${n} pcs`;
  if (unit === 'g') return locale === 'ar' ? `${n} جم` : `${n} g`;
  return locale === 'ar' ? `${n} مل` : `${n} ml`;
}

/** Pick the localized field from a bilingual record, falling back to the other language. */
export function pickLocalized(locale: Locale, en: string | null | undefined, arText: string | null | undefined): string {
  const primary = locale === 'ar' ? arText : en;
  const fallback = locale === 'ar' ? en : arText;
  return (primary && primary.trim()) || (fallback && fallback.trim()) || '';
}

export function allKeys(): MessageKey[] {
  return Object.keys(en) as MessageKey[];
}

export { en, ar };

/** "Sat 12:00–15:00" in Cairo time, Western digits in both languages (brand rule). */
export function formatSlot(startsAt: string, endsAt: string, locale: Locale): string {
  const tag = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const day = new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(new Date(startsAt));
  const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Cairo' }).format(new Date(iso));
  return `${day} ${time(startsAt)}–${time(endsAt)}`;
}
