import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiClient, Area } from '@lahloba/contracts';
import { isLocale, type Locale } from '@lahloba/i18n';
import { KEYS, readJson, type KeyValueStore } from '@lahloba/app-shell';
import { LocaleProvider, type ColorScheme } from '@lahloba/ui';

/** Location is optional. Implementations must never block manual area entry. */
export interface LocationPort {
  requestApproximate(): Promise<{ status: 'granted'; latitude: number; longitude: number } | { status: 'denied' } | { status: 'unavailable' }>;
}

export interface Nav {
  push(path: string): void;
  replace(path: string): void;
  back(): void;
}

interface AppValue {
  api: ApiClient;
  nav: Nav;
  location: LocationPort;
  store: KeyValueStore;
  area: Area | null;
  setArea(a: Area | null): void;
  /** False until the remembered area/language have been read from storage. */
  hydrated: boolean;
}

const Ctx = createContext<AppValue | null>(null);

const isArea = (v: unknown): v is Area =>
  typeof v === 'object' && v !== null && typeof (v as Area).id === 'string' && typeof (v as Area).slug === 'string';

/**
 * App state that survives reloads: the chosen area and language are stored locally and restored
 * on start. A remembered area is re-checked against the server (it may have been closed or
 * renamed) before it is trusted; if it no longer exists the person is asked to choose again.
 */
export function AppProviders(props: {
  api: ApiClient; nav: Nav; location: LocationPort; store: KeyValueStore; scheme?: ColorScheme;
  initialLocale?: Locale; initialArea?: Area | null; children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(props.initialLocale ?? 'en');
  const [area, setAreaState] = useState<Area | null>(props.initialArea ?? null);
  const [hydrated, setHydrated] = useState(props.initialArea !== undefined);
  const storeRef = useRef(props.store);

  useEffect(() => {
    if (props.initialArea !== undefined) return;
    let alive = true;
    (async () => {
      const [savedLocale, savedArea] = await Promise.all([
        storeRef.current.get(KEYS.locale),
        readJson(storeRef.current, KEYS.area, isArea),
      ]);
      if (!alive) return;
      if (isLocale(savedLocale)) setLocaleState(savedLocale);
      if (savedArea) setAreaState(savedArea);
      setHydrated(true);
      if (savedArea) {
        try {
          const fresh = (await props.api.areas()).items.find((a) => a.id === savedArea.id) ?? null;
          if (!alive) return;
          setAreaState(fresh);
          if (fresh) await storeRef.current.set(KEYS.area, JSON.stringify(fresh));
          else await storeRef.current.remove(KEYS.area);
        } catch { /* offline: keep the remembered area; the server rechecks serviceability anyway */ }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void storeRef.current.set(KEYS.locale, l);
  }, []);
  const setArea = useCallback((a: Area | null) => {
    setAreaState(a);
    void (a ? storeRef.current.set(KEYS.area, JSON.stringify(a)) : storeRef.current.remove(KEYS.area));
  }, []);

  return (
    <LocaleProvider locale={locale} setLocale={setLocale} scheme={props.scheme}>
      <Ctx.Provider value={{ api: props.api, nav: props.nav, location: props.location, store: props.store, area, setArea, hydrated }}>
        {props.children}
      </Ctx.Provider>
    </LocaleProvider>
  );
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProviders');
  return v;
}

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Loads data and exposes loading/error/ready. Errors never become an endless spinner; reload
 * keeps the caller's other state (filters, servings) untouched.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload(): void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadRef.current().then(
      (data) => alive && setState({ status: 'ready', data }),
      (error) => alive && setState({ status: 'error', error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
