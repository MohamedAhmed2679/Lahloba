import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { registerHaptics } from '@lahloba/ui';

/** Light taps for presses, a success pattern for completed payments/handoffs. Phones only. */
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  registerHaptics((kind) => {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  });
}
