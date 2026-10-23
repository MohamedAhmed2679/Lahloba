import { Redirect } from 'expo-router';
import { LoadingState } from '@lahloba/ui';
import { useApp } from '../src/AppContext';

export default function Index() {
  const { area, hydrated } = useApp();
  if (!hydrated) return <LoadingState />;
  return <Redirect href={(area ? '/home' : '/location') as never} />;
}
