import { useLocalSearchParams } from 'expo-router';
import { OrderScreen } from '../../src/screens/OrderScreens';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderScreen key={String(id)} orderId={String(id)} />;
}
