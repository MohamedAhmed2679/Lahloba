import { useLocalSearchParams } from 'expo-router';
import { RecipeScreen } from '../../src/screens/LearnScreens';

export default function RecipeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeScreen recipeId={String(id)} />;
}
