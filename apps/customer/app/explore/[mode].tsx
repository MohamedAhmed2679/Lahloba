import { useLocalSearchParams } from 'expo-router';
import { isServiceMode } from '@lahloba/domain';
import { EmptyState, Screen, useLocale } from '@lahloba/ui';
import { ResultsScreen } from '../../src/screens/ResultsScreen';

export default function ExploreRoute() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const { t } = useLocale();
  if (!isServiceMode(mode)) return <Screen><EmptyState message={t('offer.unavailableVariant')} /></Screen>;
  return <ResultsScreen mode={mode} />;
}
