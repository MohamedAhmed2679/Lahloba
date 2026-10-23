import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError, NetworkError, createApiClient, newIdempotencyKey, type ApiClient, type OpsApplicationDetail, type PartnerApplicationDto } from '@lahloba/contracts';
import { direction, pickLocalized, t as translate, type Locale, type MessageKey, type Vars } from '@lahloba/i18n';
import { palette, radius, space } from '@lahloba/ui/tokens';

/**
 * O01 operations console: partner verification queue. Every permission is enforced by the API;
 * this UI only reflects it. Decisions require a reason (audited) and an expected version.
 * Evidence is shown as metadata only — files are not retrievable until private storage exists.
 */
const c = palette.light;
const styles = {
  page: { fontFamily: 'system-ui, sans-serif', background: c.background, color: c.text, minHeight: '100vh', padding: space.xl } as CSSProperties,
  panel: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: space.lg } as CSSProperties,
  button: { minHeight: 44, padding: `0 ${space.lg}px`, borderRadius: radius.md, border: `2px solid ${c.accent}`, background: c.accent, color: c.onAccent, fontWeight: 600, cursor: 'pointer' } as CSSProperties,
  secondary: { minHeight: 44, padding: `0 ${space.lg}px`, borderRadius: radius.md, border: `1px solid ${c.border}`, background: c.surface, color: c.text, cursor: 'pointer' } as CSSProperties,
  alert: { padding: space.md, borderRadius: radius.md, border: `1px solid ${c.danger}`, color: c.danger, background: c.surfaceMuted } as CSSProperties,
  field: { width: '100%', minHeight: 44, padding: space.sm, borderRadius: radius.md, border: `1px solid ${c.border}`, font: 'inherit', boxSizing: 'border-box' } as CSSProperties,
};

export function OpsApp(props: { apiUrl: string; devStubEnabled: boolean; apiFactory?: (getToken: () => string | null) => ApiClient }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const api = useMemo(
    () => (props.apiFactory ?? ((g) => createApiClient({ baseUrl: props.apiUrl, getToken: g })))(() => tokenRef.current),
    [props.apiUrl, props.apiFactory],
  );
  const t = useCallback((k: MessageKey, v?: Vars) => translate(locale, k, v), [locale]);

  useEffect(() => {
    document.documentElement.dir = direction(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main style={styles.page} dir={direction(locale)}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{t('ops.title')}</h1>
        <div style={{ display: 'flex', gap: space.sm }}>
          <button style={styles.secondary} onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{locale === 'ar' ? t('common.switchToEnglish') : t('common.switchToArabic')}</button>
          {token ? <button style={styles.secondary} onClick={() => setToken(null)}>{t('common.signOut')}</button> : null}
        </div>
      </header>
      {token ? <Queue api={api} t={t} locale={locale} /> : <SignIn api={api} t={t} devStubEnabled={props.devStubEnabled} onToken={setToken} />}
    </main>
  );
}

type T = (k: MessageKey, v?: Vars) => string;

function SignIn(props: { api: ApiClient; t: T; devStubEnabled: boolean; onToken: (t: string) => void }) {
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
    <section style={{ ...styles.panel, marginTop: space.xl, maxWidth: 480 }}>
      <p role="note">{props.t('partner.signInUnavailable')}</p>
      {props.devStubEnabled ? (
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

function Queue(props: { api: ApiClient; t: T; locale: Locale }) {
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
    <div style={{ display: 'grid', gap: space.lg, gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 2fr)', marginTop: space.xl }}>
      <section style={styles.panel} aria-labelledby="queue-h">
        <h2 id="queue-h">{t('ops.queue')}</h2>
        {items.length === 0 ? <p>{t('ops.empty')}</p> : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: space.sm }}>
            {items.map((a) => (
              <li key={a.id}>
                <button style={{ ...styles.secondary, width: '100%', textAlign: 'start', borderWidth: selected === a.id ? 2 : 1 }}
                  aria-current={selected === a.id ? 'true' : undefined} onClick={() => setSelected(a.id)} data-testid={`queue-${a.id}`}>
                  {selected === a.id ? '✓ ' : ''}{t(`partner.role.${a.kind}` as const)} · {new Date(a.submittedAt).toLocaleString()} · {a.evidenceCount} 📄
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected ? <Detail key={selected} api={api} t={t} locale={props.locale} id={selected} onDecided={() => { setSelected(null); void load(); }} /> : null}
    </div>
  );
}

function Detail(props: { api: ApiClient; t: T; locale: Locale; id: string; onDecided: () => void }) {
  const { api, t } = props;
  const [d, setD] = useState<OpsApplicationDetail | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reason, setReason] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  useEffect(() => {
    api.opsApplication(props.id).then(setD, () => setError(t('common.error.generic')));
  }, [api, props.id, t]);

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
      const code = err instanceof ApiError ? err.code : '';
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

  if (!d) return <section style={styles.panel}>{error ? <p role="alert" style={styles.alert}>{error}</p> : <p aria-busy="true">{t('common.loading')}</p>}</section>;
  return (
    <section style={styles.panel} aria-labelledby="detail-h" data-testid="detail">
      <h2 id="detail-h">{d.subjectSummary.publicName} — {t(`partner.role.${d.kind}` as const)}</h2>
      <p>{d.applicant.displayName ?? d.applicant.userId}</p>
      {d.subjectSummary.area ? <p>{pickLocalized(props.locale, d.subjectSummary.area.en, d.subjectSummary.area.ar)}</p> : null}
      {d.subjectSummary.equipment.length ? <p>{d.subjectSummary.equipment.map((e) => t(`equipment.${e}` as const)).join(', ')}</p> : null}
      <h3>{t('partner.evidence')}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th scope="col" style={{ textAlign: 'start' }}>Type</th><th scope="col" style={{ textAlign: 'start' }}>Format</th><th scope="col" style={{ textAlign: 'start' }}>Expires</th></tr></thead>
        <tbody>
          {d.evidence.map((e) => (
            <tr key={e.evidenceId}><td>{e.evidenceType}</td><td>{e.contentType}</td><td>{e.expiresOn ?? '—'}</td></tr>
          ))}
        </tbody>
      </table>
      <p role="note">{t('partner.evidenceDisabled')}</p>
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
        <button type="submit" style={styles.button} disabled={busy} aria-busy={busy}>{decision === 'APPROVE' ? t('ops.approve') : t('ops.reject')}</button>
      </form>
    </section>
  );
}
