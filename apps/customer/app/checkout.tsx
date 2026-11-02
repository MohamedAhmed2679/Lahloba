import { useLocalSearchParams } from 'expo-router';
import { CheckoutScreen } from '../src/screens/CheckoutScreen';

export default function CheckoutRoute() {
  const p = useLocalSearchParams<{ offerId: string; servings: string; source: string; slotId: string }>();
  return <CheckoutScreen offerId={String(p.offerId)} servings={Number(p.servings)} source={p.source === 'SUPPLIERS' ? 'SUPPLIERS' : 'CHEF'} slotId={String(p.slotId)} />;
}
