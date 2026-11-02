import { useEffect, useRef, useState } from 'react';
import type { DishSearchResponse } from '@lahloba/contracts';
import { EmptyState, ErrorState, LoadingState, Notice, Reveal, Screen, Text, TextField, useLocale } from '@lahloba/ui';
import { useApp } from '../AppContext';
import { OfferCardItem, TopBar, errorMessage } from './shared';

/** Find a dish by describing it ("something light with chicken") in Arabic or English. */
export function SearchScreen(props: { initialQuery?: string }) {
  const { api, area, nav } = useApp();
  const { t } = useLocale();
  const [q, setQ] = useState(props.initialQuery ?? '');
  const [result, setResult] = useState<DishSearchResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!area) return;
    const text = q.trim();
    if (text.length < 2) { setResult(null); setError(null); return; }
    const mine = ++seq.current;
    // Search as the person types, after a short pause; only the latest answer is shown.
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await api.searchDishes({ area: area.id, q: text });
        if (mine === seq.current) { setResult(r); setError(null); }
      } catch (e) { if (mine === seq.current) setError(e); } finally { if (mine === seq.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, area, api]);

  if (!area) {
    return <Screen><TopBar /><EmptyState message={t('search.needArea')} actionLabel={t('search.chooseArea')} onAction={() => nav.push('/location')} /></Screen>;
  }
  return (
    <Screen testID="search">
      <TopBar />
      <Text variant="display" role="header">{t('search.title')}</Text>
      <TextField label={t('search.label')} hint={t('search.hint')} value={q} onChangeText={setQ} testID="search-input" />
      {busy && !result ? <LoadingState /> : null}
      {error ? <ErrorState message={errorMessage(t, error)} onRetry={() => setQ((x) => `${x}`)} /> : null}
      {result?.serviceability === 'UNSUPPORTED_AREA' ? <Notice tone="warning">{t('location.unsupported')}</Notice> : null}
      {result && result.serviceability === 'SERVICEABLE' ? (
        result.items.length === 0 ? (
          <EmptyState message={t('search.empty')} testID="search-empty" />
        ) : (
          <Reveal key={`${q.trim()}-${result.items.length}`} testID="search-results" from={4} style={{ gap: 12 }}>
            <Text variant="caption" muted testID="search-mode">{result.mode === 'semantic' ? t('search.byMeaning') : t('search.byWords')}</Text>
            {result.items.map((o) => <OfferCardItem key={o.offerId} offer={o} />)}
          </Reveal>
        )
      ) : null}
    </Screen>
  );
}
