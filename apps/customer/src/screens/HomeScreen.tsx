import { ENTRY_POINTS, type EntryPoint } from '@lahloba/domain';
import { pickLocalized } from '@lahloba/i18n';
import { LanguageSwitch, Notice, Row, Screen, ServiceModeCard, Text, useLocale } from '@lahloba/ui';
import { View } from 'react-native';
import { useApp } from '../AppContext';
import { TopBar } from './shared';

/** C02: five entry cards. Each opens its own catalog; Learn never requires an area. */
export function HomeScreen() {
  const { nav, area } = useApp();
  const { t, locale } = useLocale();
  const unsupported = area !== null && !area.physicalOrderingEnabled;

  const open = (e: EntryPoint) => {
    if (e === 'LEARN') return nav.push('/learn');
    if (!area) return nav.push('/location');
    if (e === 'GROCERIES') return nav.push('/groceries');
    return nav.push(`/explore/${e}`);
  };

  return (
    <Screen testID="home">
      <TopBar showBack={false} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="display" role="header">{t('home.title')}</Text>
        <LanguageSwitch />
      </Row>
      {area ? <Text muted>{t('location.selected', { area: pickLocalized(locale, area.label.en, area.label.ar) })}</Text> : null}
      {unsupported ? <Notice tone="warning" testID="unsupported-area">{t('location.unsupported')}</Notice> : null}
      <View style={{ gap: 12 }}>
        {ENTRY_POINTS.map((e) => (
          <ServiceModeCard key={e} entry={e} onPress={() => open(e)} />
        ))}
      </View>
    </Screen>
  );
}
