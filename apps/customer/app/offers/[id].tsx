import { useLocalSearchParams } from 'expo-router';
import { OfferDetailScreen } from '../../src/screens/OfferDetailScreen';

export default function OfferRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferDetailScreen key={String(id)} offerId={String(id)} />;
}
