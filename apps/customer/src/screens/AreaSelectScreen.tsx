import { useState } from 'react';
import type { Area } from '@lahloba/contracts';
import { Button, Card, ErrorState, LanguageSwitch, LoadingState, Notice, Row, Screen, Text, useLocale } from '@lahloba/ui';
import { pickLocalized } from '@lahloba/i18n';
import { useApp, useAsync } from '../AppContext';
import { errorMessage } from './shared';

/**
 * C01: Manual area selection always works. Location permission is optional; denial or failure
 * shows a message and leaves the manual list fully usable. Because service-area boundaries are
 * not modelled yet (no geospatial lookup), a granted location only shows a hint — it never
 * silently picks an area.
 */
export function AreaSelectScreen() {
  const { api, location, setArea, area, nav } = useApp();
  const { t, locale } = useLocale();
  const areas = useAsync(() => api.areas(), []);
  const [locationNote, setLocationNote] = useState<'denied' | 'unavailable' | 'detected' | null>(null);
  const [asking, setAsking] = useState(false);

  const askLocation = async () => {
    setAsking(true);
    try {
      const r = await location.requestApproximate();
      setLocationNote(r.status === 'granted' ? 'detected' : r.status);
    } catch {
      setLocationNote('unavailable');
    } finally {
      setAsking(false);
    }
  };

  const choose = (a: Area) => {
    setArea(a);
    nav.replace('/home');
  };

  return (
    <Screen testID="area-select">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="display" role="header">{t('location.title')}</Text>
        <LanguageSwitch />
      </Row>
      <Text muted>{t('location.subtitle')}</Text>
      <Button variant="secondary" label={t('location.useMyLocation')} onPress={askLocation} loading={asking} testID="use-location" />
      {locationNote === 'denied' ? <Notice tone="warning" testID="location-denied">{t('location.denied')}</Notice> : null}
      {locationNote === 'unavailable' ? <Notice tone="warning" testID="location-unavailable">{t('location.unavailable')}</Notice> : null}
      {locationNote === 'detected' ? <Notice testID="location-detected">{t('location.detectedHint')}</Notice> : null}

      <Text variant="title" role="header">{t('location.chooseManually')}</Text>
      {areas.status === 'loading' ? <LoadingState /> : null}
      {areas.status === 'error' ? <ErrorState message={errorMessage(t, areas.error)} onRetry={areas.reload} /> : null}
      {areas.status === 'ready'
        ? areas.data.items.map((a) => {
            const label = pickLocalized(locale, a.label.en, a.label.ar);
            const selected = area?.id === a.id;
            return (
              <Card key={a.id} onPress={() => choose(a)} testID={`area-${a.slug}`}
                accessibilityLabel={`${label}${a.physicalOrderingEnabled ? '' : `. ${t('location.comingSoon')}`}${selected ? '. ✓' : ''}`}>
                <Text variant="label">{selected ? `✓ ${label}` : label}</Text>
                {!a.physicalOrderingEnabled ? <Text variant="caption" muted>{t('location.comingSoon')}</Text> : null}
              </Card>
            );
          })
        : null}
    </Screen>
  );
}
