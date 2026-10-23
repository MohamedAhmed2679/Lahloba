import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Locale } from '@lahloba/i18n';
import { AllergenNotice, Chip, LanguageSwitch, LocaleProvider, ServiceModeCard, ServingStepper } from './index';

afterEach(cleanup);

function Harness(props: { initial?: Locale; children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(props.initial ?? 'en');
  return <LocaleProvider locale={locale} setLocale={setLocale}>{props.children}</LocaleProvider>;
}

describe('LocaleProvider and RTL', () => {
  it('switches document direction and language when toggled', () => {
    render(<Harness><LanguageSwitch /></Harness>);
    expect(document.documentElement.dir).toBe('ltr');
    act(() => { fireEvent.click(screen.getByTestId('language-switch')); });
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(screen.getByTestId('language-switch').textContent).toContain('English');
  });

  it('renders Arabic entry copy in RTL', () => {
    render(<Harness initial="ar"><ServiceModeCard entry="EAT_NOW" onPress={() => {}} /></Harness>);
    expect(screen.getByTestId('entry-EAT_NOW').textContent).toContain('كُل الآن');
    expect(screen.getByTestId('locale-root').getAttribute('dir') ?? getComputedStyle(screen.getByTestId('locale-root')).direction).toBe('rtl');
  });
});

describe('ServingStepper', () => {
  it('respects min, max and step and disables at bounds', () => {
    function S() {
      const [v, setV] = useState(2);
      return <ServingStepper value={v} rules={{ minServings: 2, maxServings: 6, servingStep: 2 }} onChange={setV} />;
    }
    render(<Harness><S /></Harness>);
    const dec = screen.getByTestId('servings-decrease');
    expect(dec.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('servings-increase'));
    fireEvent.click(screen.getByTestId('servings-increase'));
    expect(screen.getByTestId('servings-value').textContent).toBe('For 6 people');
    expect(screen.getByTestId('servings-increase').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('accessibility semantics', () => {
  it('chip conveys selection by text and checked state, not color only', () => {
    render(<Harness><Chip label="Egyptian" selected count={3} onToggle={() => {}} testID="chip" /></Harness>);
    const chip = screen.getByTestId('chip');
    expect(chip.textContent).toBe('✓ Egyptian (3)');
    expect(chip.getAttribute('aria-checked')).toBe('true');
    expect(chip.getAttribute('role')).toBe('checkbox');
  });

  it('service cards are focusable buttons with a combined label', () => {
    render(<Harness><ServiceModeCard entry="LEARN" onPress={() => {}} /></Harness>);
    const card = screen.getByTestId('entry-LEARN');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('aria-label')).toContain('Recipes & guidance');
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('unknown allergen data is a warning, never "none"', () => {
    render(<Harness><AllergenNotice status="UNKNOWN" allergens={[]} /></Harness>);
    expect(screen.getByTestId('allergen-unknown').textContent).toContain('do not assume');
  });
});
