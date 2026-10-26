import { createElement, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { ApiError, NetworkError, createApiClient, newIdempotencyKey, type ApiClient, type OpsApplicationDetail, type PartnerApplicationDto } from '@lahloba/contracts';
import { direction, pickLocalized, t as translate, type Locale, type MessageKey, type Vars } from '@lahloba/i18n';
import { ART, type ArtNode } from '@lahloba/ui/brand-art';
import { brand, palette, radius, space } from '@lahloba/ui/tokens';

/**
 * O01 operations console: partner verification queue. Every permission is enforced by the API;
 * this UI only reflects it. Decisions require a reason (audited) and an expected version.
 * Evidence files are private: reviewers open them through a 5-minute signed link that the API
 * issues and audits. Nothing here caches or embeds the file.
 */
const c = palette.light;
const FONT_UI = '"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif';
const FONT_DISPLAY = '"Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif';
const styles = {
  page: { fontFamily: FONT_UI, background: c.background, color: c.text, minHeight: '100vh', padding: space.xl, boxSizing: 'border-box' } as CSSProperties,
  panel: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: space.lg, boxShadow: '0 1px 2px rgba(42,28,23,0.06)' } as CSSProperties,
  button: { minHeight: 48, padding: `0 ${space.lg}px`, borderRadius: radius.md, border: `2px solid ${c.accent}`, background: c.accent, color: c.onAccent, fontWeight: 600, cursor: 'pointer', font: 'inherit' } as CSSProperties,
  secondary: { minHeight: 48, padding: `0 ${space.lg}px`, borderRadius: radius.md, border: `1px solid ${c.border}`, background: c.surface, color: c.text, cursor: 'pointer', font: 'inherit' } as CSSProperties,
  alert: { padding: space.md, borderRadius: radius.md, border: `1px solid ${c.danger}`, color: c.danger, background: c.dangerSurface } as CSSProperties,
  note: { padding: space.md, borderRadius: radius.md, color: c.text, background: c.infoSurface } as CSSProperties,
  field: { width: '100%', minHeight: 48, padding: space.sm, borderRadius: radius.md, border: `1px solid ${c.border}`, font: 'inherit', boxSizing: 'border-box' } as CSSProperties,
  h: { fontFamily: FONT_DISPLAY, fontWeight: 600 } as CSSProperties,
  cell: { textAlign: 'start', padding: `${space.sm}px ${space.xs}px`, borderBottom: `1px solid ${c.border}`, verticalAlign: 'top' } as CSSProperties,
};

/** Sign-in supplied by the host (Clerk in deployed builds). Without it the console offers the dev stub only. */
export interface OpsAuth {
  signedIn: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => void;
  /** Rendered when signed out, e.g. Clerk's <SignIn />. */
  signIn: ReactNode;
}

export function OpsApp(props: {
  apiUrl: string; devStubEnabled: boolean; auth?: OpsAuth;
  apiFactory?: (getToken: () => Promise<string | null>) => ApiClient;
  openUrl?: (url: string) => void;
}) {
  const [locale, setLocale] = useState<Locale>('en');
  const [devToken, setDevToken] = useState<string | null>(null);
  const authRef = useRef(props.auth);
  authRef.current = props.auth;
  const devRef = useRef<string | null>(null);
  devRef.current = devToken;
  const api = useMemo(
    () => (props.apiFactory ?? ((g) => createApiClient({ baseUrl: props.apiUrl, getToken: g })))(
      async () => (authRef.current?.signedIn ? authRef.current.getToken() : devRef.current),
    ),
    [props.apiUrl, props.apiFactory],
  );
  const t = useCallback((k: MessageKey, v?: Vars) => translate(locale, k, v), [locale]);
  const signedIn = props.auth ? props.auth.signedIn : !!devToken;
  const openUrl = props.openUrl ?? ((url: string) => window.open(url, '_blank', 'noopener,noreferrer'));
  const absolute = (url: string) => (url.startsWith('/') ? `${props.apiUrl.replace(/\/$/, '')}${url}` : url);

  useEffect(() => {
    document.documentElement.dir = direction(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main style={styles.page} dir={direction(locale)}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space.md, flexWrap: 'wrap', paddingBottom: space.md, borderBottom: `4px solid ${brand.hibiscus700}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
          <Art name={locale === 'ar' ? 'lockupAr' : 'lockupEn'} height={36} label="Lahloba" />
          <h1 style={{ ...styles.h, margin: 0, fontSize: 20, color: c.textMuted }}>{t('ops.title')}</h1>
        </div>
        <div style={{ display: 'flex', gap: space.sm }}>
          <button style={styles.secondary} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} lang={locale === 'ar' ? 'en' : 'ar'}>
            {locale === 'ar' ? t('common.switchToEnglish') : t('common.switchToArabic')}
          </button>
          {signedIn ? <button style={styles.secondary} onClick={() => (props.auth ? props.auth.signOut() : setDevToken(null))}>{t('common.signOut')}</button> : null}
        </div>
      </header>
      {signedIn
        ? <Queue api={api} t={t} locale={locale} open={(u) => openUrl(absolute(u))} />
        : <SignIn api={api} t={t} devStubEnabled={props.devStubEnabled} external={props.auth?.signIn} onToken={setDevToken} />}
    </main>
  );
}

type T = (k: MessageKey, v?: Vars) => string;

/** Brand artwork drawn from the kit (semantic colours resolved to the light palette). */
function Art(props: { name: string; height: number; label?: string }) {
  const art = ART[props.name];
  if (!art) return null;
  const [, , w, h] = art.viewBox.split(' ').map(Number) as [number, number, number, number];
  const pal: Record<string, string> = { ink: c.ink, accent: c.portion, paper: c.paper, turmeric: c.turmeric };
  const draw = (n: ArtNode, key: string): ReactElement => {
    const { t: tag, c: kids, fill, stroke, ...rest } = n;
    const col = (v?: string) => (v === undefined ? undefined : pal[v] ?? v);
    return createElement(tag, { ...rest, key, fill: col(fill), stroke: col(stroke) }, ...(kids ?? []).map((k, i) => draw(k, `${key}.${i}`)));
  };
  return (
    <svg width={(props.height * w) / h} height={props.height} viewBox={art.viewBox} role={props.label ? 'img' : undefined} aria-label={props.label} aria-hidden={props.label ? undefined : true}>
      {art.c.map((n, i) => draw(n, String(i)))}
    </svg>
  );
}

function SignIn(props: { api: ApiClient; t: T; devStubEnabled: boolean; external?: ReactNode; onToken: (t: string) => void }) {
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      props.onToken((await props.api.devToken({ subject })).token);
    } catch {
      setError(props.t('common.error.generic'));
    }
  };
  return (
    <section style={{ ...styles.panel, marginTop: space.xl, maxWidth: 520, display: 'grid', gap: space.md }} aria-labelledby="signin-h">
      <h2 id="signin-h" style={{ ...styles.h, margin: 0 }}>{props.t('ops.signInTitle')}</h2>
      <p style={{ margin: 0, color: c.textMuted }}>{props.t('ops.staffOnly')}</p>
      {props.external ?? <p role="note" style={styles.note}>{props.t('partner.signInUnavailable')}</p>}
      {props.devStubEnabled && !props.external ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: space.sm }}>
          <label htmlFor="subject">{props.t('partner.devSubject')}</label>
          <input id="subject" style={styles.field} value={subject} onChange={(e) => setSubject(e.target.value.trim().toLowerCase())} autoComplete="off" />
          {error ? <p role="alert" style={styles.alert}>{error}</p> : null}
          <button type="submit" style={styles.button}>{props.t('partner.devSignIn')}</button>
        </form>
      ) : null}
    </section>
  );
}

function Queue(props: { api: ApiClient; t: T; locale: Locale; open: (url: string) => void }) {
  const { api, t } = props;
  const [items, setItems] = useState<PartnerApplicationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await api.opsApplications('SUBMITTED')).items);
    } catch (e) {
      setItems(null);
      setError(e instanceof ApiError && e.status === 403 ? t('ops.notAuthorized') : e instanceof NetworkError ? t('common.error.network') : t('common.error.generic'));
    }
  }, [api, t]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p role="alert" style={{ ...styles.alert, marginTop: space.xl }}>{error}</p>;
  if (!items) return <p aria-busy="true">{t('common.loading')}</p>;
  return (
    <div style={{ display: 'grid', gap: space.lg, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: space.xl, alignItems: 'start' }}>
      <section style={styles.panel} aria-labelledby="queue-h">
        <h2 id="queue-h" style={{ ...styles.h, marginTop: 0 }}>{t('ops.queue')}</h2>
        {items.length === 0 ? <p>{t('ops.empty')}</p> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: space.sm }}>
            {items.map((a) => (
              <li key={a.id}>
                <button style={{ ...styles.secondary, width: '100%', textAlign: 'start', borderColor: selected === a.id ? c.accent : c.border, borderWidth: selected === a.id ? 2 : 1, background: selected === a.id ? c.accentSoft : c.surface }}
                  aria-current={selected === a.id ? 'true' : undefined} onClick={() => setSelected(a.id)} data-testid={`queue-${a.id}`}>
                  {selected === a.id ? '✓ ' : ''}{t(`partner.role.${a.kind}` as const)} · {new Date(a.submittedAt).toLocaleString()} · {a.evidenceCount} 📄
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected ? <Detail key={selected} api={api} t={t} locale={props.locale} id={selected} open={props.open} onDecided={() => { setSelected(null); void load(); }} /> : null}
    </div>
  );
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Detail(props: { api: ApiClient; t: T; locale: Locale; id: string; open: (url: string) => void; onDecided: () => void }) {
  const { api, t } = props;
  const [d, setD] = useState<OpsApplicationDetail | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reason, setReason] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  useEffect(() => {
    api.opsApplication(props.id).then(setD, () => setError(t('common.error.generic')));
  }, [api, props.id, t]);

  const openFile = async (evidenceId: string) => {
    setFileError(null);
    try {
      props.open((await api.opsEvidenceLink(evidenceId)).url);
    } catch {
      setFileError(t('ops.evidence.linkFailed'));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!d) return;
    if (reason.trim().length < 3 || (decision === 'REJECT' && nextStep.trim().length < 3)) return setError(t('partner.form.required'));
    setBusy(true);
    setError(null);
    try {
      const body = decision === 'APPROVE'
        ? { decision, reason: reason.trim(), expectedVersion: d.version }
        : { decision, reason: reason.trim(), permittedNextStep: nextStep.trim(), expectedVersion: d.version };
      await api.opsDecide(d.id, body, key.current);
      props.onDecided();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(
        err instanceof ApiError && err.status === 403 && /own/.test(err.message) ? t('ops.selfReview')
          : code === 'VERSION_CONFLICT' || code === 'ALREADY_DECIDED' ? t('ops.conflict')
          : code === 'EVIDENCE_REQUIRED' ? t('ops.evidenceRequired')
          : t('common.error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <section style={styles.panel} aria-busy={!error}>{error ? <p role="alert" style={styles.alert}>{error}</p> : t('common.loading')}</section>;
  const anyUnscanned = d.evidence.some((e) => e.fileState === 'UPLOADED' && e.scanState === 'NOT_SCANNED');
  return (
    <section style={styles.panel} data-testid="detail" aria-labelledby="detail-h">
      <h2 id="detail-h" style={{ ...styles.h, marginTop: 0 }}>{d.subjectSummary.publicName}</h2>
      <p>{d.applicant.displayName ?? d.applicant.userId}</p>
      {d.subjectSummary.area ? <p>{pickLocalized(props.locale, d.subjectSummary.area.en, d.subjectSummary.area.ar)}</p> : null}
      {d.subjectSummary.equipment.length ? <p>{d.subjectSummary.equipment.map((e) => t(`equipment.${e}` as const)).join(', ')}</p> : null}
      <h3 style={styles.h}>{t('partner.evidence')}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th scope="col" style={styles.cell}>{t('ops.evidence.type')}</th>
            <th scope="col" style={styles.cell}>{t('ops.evidence.format')}</th>
            <th scope="col" style={styles.cell}>{t('ops.evidence.size')}</th>
            <th scope="col" style={styles.cell}>{t('ops.evidence.file')}</th>
          </tr></thead>
          <tbody>
            {d.evidence.map((e) => (
              <tr key={e.evidenceId} data-testid={`evidence-${e.evidenceId}`}>
                <td style={styles.cell}>{t(`evidenceType.${e.evidenceType}` as const)}</td>
                <td style={styles.cell}>{e.contentType.replace('application/', '').replace('image/', '').toUpperCase()}</td>
                <td style={styles.cell}>{e.fileState === 'UPLOADED' ? kb(e.byteSize) : '—'}</td>
                <td style={styles.cell}>
                  {e.fileState === 'UPLOADED'
                    ? <button style={styles.secondary} onClick={() => openFile(e.evidenceId)} data-testid={`open-${e.evidenceId}`}>{t('ops.evidence.open')}</button>
                    : e.fileState === 'PENDING_UPLOAD' ? <span>⧗ {t('ops.evidence.pendingUpload')}</span>
                    : e.fileState === 'REJECTED_FILE' ? <span style={{ color: c.danger }}>✕ {t('ops.evidence.rejectedFile')}</span>
                    : <span>{t('ops.evidence.referenceOnly')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p role="note" style={{ color: c.textMuted }}>{t('ops.evidence.linkNote')}</p>
      {anyUnscanned ? <p role="note" style={{ ...styles.note, background: c.warningSurface }}>⚠ {t('ops.evidence.notScanned')}</p> : null}
      {fileError ? <p role="alert" style={styles.alert}>{fileError}</p> : null}
      <form onSubmit={submit} style={{ display: 'grid', gap: space.sm }}>
        <fieldset style={{ border: 0, padding: 0, display: 'flex', gap: space.lg }}>
          <legend>{t('ops.approve')} / {t('ops.reject')}</legend>
          <label><input type="radio" name="decision" checked={decision === 'APPROVE'} onChange={() => setDecision('APPROVE')} /> {t('ops.approve')}</label>
          <label><input type="radio" name="decision" checked={decision === 'REJECT'} onChange={() => setDecision('REJECT')} /> {t('ops.reject')}</label>
        </fieldset>
        <label htmlFor="reason">{t('ops.reason')}</label>
        <textarea id="reason" style={styles.field} value={reason} onChange={(e) => setReason(e.target.value)} required />
        {decision === 'REJECT' ? (
          <>
            <label htmlFor="next">{t('ops.nextStep')}</label>
            <textarea id="next" style={styles.field} value={nextStep} onChange={(e) => setNextStep(e.target.value)} required />
          </>
        ) : null}
        {error ? <p role="alert" style={styles.alert} data-testid="decision-error">{error}</p> : null}
        <button type="submit" style={{ ...styles.button, ...(decision === 'REJECT' ? { background: c.danger, borderColor: c.danger } : {}) }} disabled={busy} aria-busy={busy}>
          {decision === 'APPROVE' ? t('ops.approve') : t('ops.reject')}
        </button>
      </form>
    </section>
  );
}
