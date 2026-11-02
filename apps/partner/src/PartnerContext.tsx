import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { pickFile as defaultPickFile, type PickFile } from './filePicker';
import { createApiClient, type ApiClient, type Me } from '@lahloba/contracts';
import { availableInterfaces, type Actor, type PublicRoleInterface } from '@lahloba/domain';
import { isLocale, type Locale } from '@lahloba/i18n';
import { KEYS, readJson, useAuth, type AuthPort, type KeyValueStore } from '@lahloba/app-shell';
import { LocaleProvider, type ColorScheme } from '@lahloba/ui';

export interface Nav { push(path: string): void; replace(path: string): void; back(): void }

export interface ActiveRole { ui: PublicRoleInterface; scopeId: string | null }

interface PartnerValue {
  pickFile: PickFile;
  api: ApiClient;
  nav: Nav;
  auth: AuthPort;
  store: KeyValueStore;
  me: Me | null;
  meError: unknown;
  refreshMe(): Promise<void>;
  /** Explicit role switch, remembered across reloads. The API enforces scope regardless. */
  activeRole: ActiveRole | null;
  switchRole(r: ActiveRole | null): void;
  interfaces: ReturnType<typeof availableInterfaces>;
}

const Ctx = createContext<PartnerValue | null>(null);
const isRole = (v: unknown): v is ActiveRole => typeof v === 'object' && v !== null && typeof (v as ActiveRole).ui === 'string';

export function PartnerProviders(props: {
  apiUrl: string; nav: Nav; store: KeyValueStore; scheme?: ColorScheme; initialLocale?: Locale; children: ReactNode;
  apiFactory?: (getToken: () => Promise<string | null>) => ApiClient;
  pickFile?: PickFile;
}) {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const [locale, setLocaleState] = useState<Locale>(props.initialLocale ?? 'en');
  const api = useMemo(
    () => (props.apiFactory ?? ((get) => createApiClient({ baseUrl: props.apiUrl, getToken: get })))(() => authRef.current.getToken()),
    [props.apiUrl, props.apiFactory],
  );
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<unknown>(null);
  const [activeRole, setActiveRole] = useState<ActiveRole | null>(null);

  useEffect(() => {
    void props.store.get(KEYS.locale).then((l) => { if (isLocale(l)) setLocaleState(l); });
    void readJson(props.store, KEYS.activeRole, isRole).then((r) => { if (r) setActiveRole(r); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMe = useCallback(async () => {
    if (authRef.current.status !== 'signedIn') { setMe(null); return; }
    try { setMe(await api.me()); setMeError(null); } catch (e) { setMeError(e); }
  }, [api]);

  useEffect(() => { void refreshMe(); }, [auth.status, refreshMe]);

  const interfaces = useMemo(() => {
    if (!me) return [];
    const actor: Actor = { userId: me.userId, status: 'ACTIVE', memberships: me.memberships };
    return availableInterfaces(actor);
  }, [me]);

  const switchRole = useCallback((r: ActiveRole | null) => {
    setActiveRole(r);
    void (r ? props.store.set(KEYS.activeRole, JSON.stringify(r)) : props.store.remove(KEYS.activeRole));
  }, [props.store]);

  // Drop a remembered role the server no longer grants (e.g. revoked or suspended membership).
  useEffect(() => {
    if (me && activeRole && !interfaces.some((i) => i.ui === activeRole.ui && i.scopeId === activeRole.scopeId)) switchRole(null);
  }, [me, interfaces, activeRole, switchRole]);

  const setLocale = useCallback((l: Locale) => { setLocaleState(l); void props.store.set(KEYS.locale, l); }, [props.store]);

  const value: PartnerValue = { pickFile: props.pickFile ?? defaultPickFile, api, nav: props.nav, auth, store: props.store, me, meError, refreshMe, activeRole, switchRole, interfaces };
  return (
    <LocaleProvider locale={locale} setLocale={setLocale} scheme={props.scheme}>
      <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
    </LocaleProvider>
  );
}

export function usePartner(): PartnerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePartner must be used inside PartnerProviders');
  return v;
}
