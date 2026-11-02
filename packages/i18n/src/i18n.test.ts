import { describe, expect, it } from 'vitest';
import { allKeys, ar, direction, en, formatMoney, formatQuantity, pickLocalized, t } from './index';

describe('i18n resources', () => {
  it('Arabic covers every English key with non-empty text', () => {
    for (const k of allKeys()) {
      expect(ar[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it('placeholders match between languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const k of allKeys()) expect(ph(ar[k]), k).toBe(ph(en[k]));
  });

  it('direction follows locale', () => {
    expect(direction('ar')).toBe('rtl');
    expect(direction('en')).toBe('ltr');
  });

  it('interpolates and keeps unknown placeholders visible', () => {
    expect(t('en', 'offer.servings', { count: 4 })).toBe('For 4 people');
    expect(t('en', 'offer.servings')).toBe('For {count} people');
  });

  it('formats the founder labor example in both languages without float money', () => {
    expect(formatMoney(4000, 'en')).toMatch(/40/);
    expect(formatMoney(4000, 'en')).toMatch(/EGP|E£/);
    expect(formatMoney(4000, 'ar')).toBe('40 ج.م');
    expect(formatMoney(4000, 'en')).toBe('EGP 40');
    expect(formatMoney(123456, 'en')).toBe('EGP 1,234.56');
    expect(formatMoney(1050, 'en')).toMatch(/10\.50/);
    expect(() => formatMoney(10.5, 'en')).toThrow(RangeError);
  });

  it('labels grams and millilitres distinctly', () => {
    expect(formatQuantity(600, 'g', 'en')).toBe('600 g');
    expect(formatQuantity(250, 'ml', 'en')).toBe('250 ml');
    expect(formatQuantity(600, 'g', 'ar')).toContain('جم');
  });

  it('falls back across languages for bilingual records', () => {
    expect(pickLocalized('ar', 'Molokhia', '')).toBe('Molokhia');
    expect(pickLocalized('ar', 'Molokhia', 'ملوخية')).toBe('ملوخية');
  });
});
