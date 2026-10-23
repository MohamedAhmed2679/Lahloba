import { useLocalSearchParams } from 'expo-router';
import { ChefProfileScreen } from '../../src/screens/ChefProfileScreen';

export default function ChefRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChefProfileScreen chefId={String(id)} />;
}
