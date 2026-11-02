import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { direction as dirOf, t as translate, type Direction, type Locale, type MessageKey, type Vars } from '@lahloba/i18n';
import { palette, type ColorScheme, type Colors } from './tokens';

export type { ColorScheme };

interface LocaleValue {
  locale: Locale;
  dir: Direction;
  t: (key: MessageKey, vars?: Vars) => string;
  setLocale: (l: Locale) => void;
  colors: Colors;
  scheme: ColorScheme;
}

const Ctx = createContext<LocaleValue | null>(null);

/**
 * Provides locale, direction and colors. On web the document `dir`/`lang` are updated so
 * screen readers and text layout follow the language. On native, the root View's `direction`
 * style mirrors layout without requiring an app restart (I18nManager.forceRTL is not used).
 */
export function LocaleProvider(props: { locale: Locale; setLocale: (l: Locale) => void; scheme?: ColorScheme; children: ReactNode }) {
  const { locale, setLocale, scheme = 'light', children } = props;
  const value = useMemo<LocaleValue>(() => {
    const dir = dirOf(locale);
    return { locale, dir, setLocale, scheme, colors: palette[scheme], t: (k, v) => translate(locale, k, v) };
  }, [locale, setLocale, scheme]);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dir = value.dir;
    document.documentElement.lang = locale;
  }

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1, direction: value.dir, backgroundColor: value.colors.background }} testID="locale-root">
        {children}
      </View>
    </Ctx.Provider>
  );
}

export function useLocale(): LocaleValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocale must be used inside LocaleProvider');
  return v;
}
